// api/controllers/topicsController.js
import pool from "../db.js";
import { listMembersByTopicSlug } from "../services/member.js";
import { getIo, userRoom, topicRoom } from "../socket.js";
import { getTopicMemberIds, emitToUsers } from "../helpers/socket-broadcast.js";

function slugify(text) {
    return text
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, "-")
        .replace(/[^a-z0-9-]+/g, "")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");
}

// Fisher–Yates shuffle
function shuffleString(str) {
    const arr = str.split("");
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join("");
}

// base62 token
import crypto from "crypto";
const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
function randomBase62(len = 8) {
    const bytes = crypto.randomBytes(len);
    let out = "";
    for (let i = 0; i < len; i++) {
        // map 0..255 -> 0..61 แบบกระจายโดยประมาณ
        out += BASE62[bytes[i] % 62];
    }
    return out;
}

// unique slug checker (เดิม)
async function ensureUniqueSlug(base, conn) {
    let candidate = base || "";
    if (!candidate) return null;

    let n = 1;
    while (true) {
        const [rows] = await conn.query(
            "SELECT id FROM topics WHERE slug = ? LIMIT 1",
            [candidate]
        );
        if (rows.length === 0) return candidate;
        n += 1;
        candidate = `${base}-${n}`;
    }
}

// GET /topics
export async function listTopics(req, res) {
    const userId = req.user.id;
    try {
        const [rows] = await pool.query(
            `SELECT t.id, t.title, t.slug, t.created_at
       FROM topics t
       INNER JOIN topic_members m ON m.topic_id = t.id
       WHERE m.user_id = ?
       ORDER BY t.id DESC`,
            [userId]
        );
        res.json({ ok: true, data: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
    }
}
// POST /topics { title, description? }
// owner_id ควรมาจาก auth middleware (JWT) แต่เดโมนี้จะ mock เป็น 1
export async function createTopic(req, res) {
    const { title, description } = req.body || {};
    const ownerId = req.user?.id || 1;

    if (!title || !title.trim()) {
        return res.status(400).json({ ok: false, error: "TITLE_REQUIRED" });
    }

    const desc = (typeof description === "string" && description.trim().length > 0)
        ? description.trim()
        : null;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        let username = req.user?.username;
        if (!username) {
            const [urows] = await conn.query(
                "SELECT username FROM users WHERE id = ? LIMIT 1",
                [ownerId]
            );
            username = urows?.[0]?.username || "user";
        }

        const usernameSlug = slugify(username);
        const shuffled = shuffleString(usernameSlug || "user");
        const token = randomBase62(8);
        const base = `${(shuffled || "user").slice(0, 8)}-${token}`.toLowerCase();
        const baseCapped = base.slice(0, 64);
        const uniqueSlug = await ensureUniqueSlug(baseCapped, conn);

        const [result] = await conn.query(
            `INSERT INTO topics (title, description, owner_id, slug)
       VALUES (?, ?, ?, ?)`,
            [title.trim(), desc, ownerId, uniqueSlug]
        );

        const topicId = result.insertId;

        await conn.query(
            `INSERT INTO topic_members (topic_id, user_id) VALUES (?, ?)`,
            [topicId, ownerId]
        );

        await conn.commit();

        // ใหม่: ยิงให้ "สมาชิกทุกคนของหัวข้อ" (ตอนนี้มี owner อยู่คนเดียว)
        try {
            const memberIds = await getTopicMemberIds(conn, topicId);
            emitToUsers(memberIds, "topics:created", {
                topic: { id: topicId, title: title.trim(), description: desc, slug: uniqueSlug },
            });
        } catch (_) { }

        return res.status(201).json({
            ok: true,
            data: {
                id: topicId,
                title: title.trim(),
                description: desc,   // ส่งค่าที่ normalize แล้วกลับไป
                slug: uniqueSlug,
            },
        });
    } catch (err) {
        await conn.rollback();
        if (err && err.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ ok: false, error: "DUPLICATE_SLUG" });
        }
        console.error(err);
        return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
    } finally {
        conn.release();
    }
}

async function requireMemberBySlug(conn, userId, slug) {
    // หา topic ก่อน
    const [[topic]] = await conn.query(
        "SELECT id FROM topics WHERE slug = ? LIMIT 1",
        [slug]
    );
    if (!topic) return { error: "TOPIC_NOT_FOUND" };

    // เช็คสิทธิ์สมาชิก
    const [[m]] = await conn.query(
        "SELECT 1 FROM topic_members WHERE topic_id = ? AND user_id = ? LIMIT 1",
        [topic.id, userId]
    );
    if (!m) return { error: "FORBIDDEN" };

    return { topicId: topic.id };
}

export async function getTopicBySlug(req, res) {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const conn = await pool.getConnection();
    try {
        const check = await requireMemberBySlug(conn, userId, req.params.slug);

        if (check.error === "TOPIC_NOT_FOUND") {
            return res.status(404).json({ ok: false, error: "NOT_FOUND" });
        }
        if (check.error === "FORBIDDEN") {
            return res.status(403).json({ ok: false, error: "FORBIDDEN" });
        }

        const [[row]] = await conn.query(
            `SELECT id, title, slug, owner_id, description
   FROM topics
   WHERE id = ?
   LIMIT 1`,
            [check.topicId]
        );

        // เผื่อเคสหาไม่เจอหลังเช็ค member (แทบไม่เกิด แต่กันไว้)
        if (!row) {
            return res.status(404).json({ ok: false, error: "NOT_FOUND" });
        }

        const is_owner = String(row.owner_id) === String(userId);

        // ✅ ส่งครั้งเดียว แล้ว return ออกให้ชัด
        return res.json({ ok: true, data: { ...row, is_owner } });
    } catch (err) {
        console.error(err);
        // กัน double-send: ถ้าส่งไปแล้วอย่าพยายามส่งอีก
        if (!res.headersSent) {
            return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
        }
    } finally {
        conn.release();
    }
}

// GET /topics/:slug/lists
export async function listListsByTopicSlug(req, res) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const conn = await pool.getConnection();
    try {
        const check = await requireMemberBySlug(conn, userId, req.params.slug);
        if (check.error === "TOPIC_NOT_FOUND")
            return res.status(404).json({ ok: false, error: "TOPIC_NOT_FOUND" });
        if (check.error === "FORBIDDEN")
            return res.status(403).json({ ok: false, error: "FORBIDDEN" });

        const [rows] = await conn.query(
            `SELECT id, title, description, status, position, created_at
         FROM lists
         WHERE topic_id = ?
         ORDER BY position ASC, id DESC`,
            [check.topicId]
        );

        res.json({ ok: true, data: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
    } finally {
        conn.release();
    }
}

// POST /topics/:slug/lists  { title }
export async function createListByTopicSlug(req, res) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const { title, description } = req.body || {};
    if (!title || !title.trim()) {
        return res.status(400).json({ ok: false, error: "TITLE_REQUIRED" });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const check = await requireMemberBySlug(conn, userId, req.params.slug);
        if (check.error === "TOPIC_NOT_FOUND") {
            await conn.rollback();
            return res.status(404).json({ ok: false, error: "TOPIC_NOT_FOUND" });
        }
        if (check.error === "FORBIDDEN") {
            await conn.rollback();
            return res.status(403).json({ ok: false, error: "FORBIDDEN" });
        }

        const [result] = await conn.query(
            `INSERT INTO lists (topic_id, title, description, status, position, created_by)
       VALUES (?, ?, ?, 'active', 0, ?)`,
            [check.topicId, title.trim(), description ?? null, userId]
        );

        await conn.commit();

        // 🔔 broadcast ไปทุกคนในหน้า topic นี้
        try {
            getIo().to(topicRoom(req.params.slug)).emit("lists:created", {
                slug: req.params.slug,
                list: {
                    id: result.insertId,
                    title: title.trim(),
                    description: description ?? null,
                    status: "active",
                },
            });
        } catch { }

        res.status(201).json({
            ok: true,
            data: { id: result.insertId, title: title.trim(), status: "active" },
        });
    } catch (err) {
        await conn.rollback();
        if (err?.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ ok: false, error: "DUPLICATE_TITLE" });
        }
        console.error(err);
        res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
    } finally {
        conn.release();
    }
}

export async function listOwnedTopics(req, res) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    try {
        const [rows] = await pool.query(
            `SELECT t.id, t.title, t.slug, t.created_at
       FROM topics t
       WHERE t.owner_id = ?
       ORDER BY t.id DESC`,
            [userId]
        );
        res.json({ ok: true, data: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
    }
}

export async function updateTopicTitleOwnerOnly(req, res) {
    const userId = req.user?.id;
    const id = Number(req.params.id || 0);
    const { title } = req.body || {};
    if (!userId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!id || !title || !title.trim()) {
        return res.status(400).json({ ok: false, error: "BAD_REQUEST" });
    }

    try {
        // ตรวจว่าเป็น owner
        const [rows] = await pool.query(
            "SELECT id FROM topics WHERE id = ? AND owner_id = ? LIMIT 1",
            [id, userId]
        );
        if (rows.length === 0) {
            return res.status(403).json({ ok: false, error: "FORBIDDEN" });
        }

        await pool.query("UPDATE topics SET title = ? WHERE id = ?", [title.trim(), id]);
        // ยิงให้สมาชิกทุกคนของหัวข้อนี้
        const conn2 = await pool.getConnection();
        try {
            const memberIds = await getTopicMemberIds(conn2, id);
            emitToUsers(memberIds, "topics:updated", {
                topic: { id, title: title.trim() },
            });
        } finally {
            conn2.release();
        }

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
    }
}

export async function deleteTopicOwnerOnly(req, res) {
    const userId = req.user?.id;
    const id = Number(req.params.id || 0);
    if (!userId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!id) return res.status(400).json({ ok: false, error: "BAD_REQUEST" });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // ตรวจว่าเป็น owner
        const [[own]] = await conn.query(
            "SELECT id FROM topics WHERE id = ? AND owner_id = ? LIMIT 1",
            [id, userId]
        );
        if (!own) {
            await conn.rollback();
            return res.status(403).json({ ok: false, error: "FORBIDDEN" });
        }

        // 1) เก็บรายชื่อสมาชิกก่อนลบ
        const memberIds = await getTopicMemberIds(conn, id);

        // ลบหัวข้อ (FK จะลบ lists / topic_members ที่ผูกแบบ CASCADE ให้ ตาม schema)
        await conn.query("DELETE FROM topics WHERE id = ?", [id]);

        await conn.commit();
        // ใหม่: แจ้งสมาชิกทุกคนว่าหัวข้อนี้หายไป
        try { emitToUsers(memberIds, "topics:deleted", { id }); } catch (_) { }

        res.json({ ok: true });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
    } finally {
        conn.release();
    }
}

export async function listTopicMembers(req, res) {
    const { slug } = req.params;
    const data = await listMembersByTopicSlug(slug);
    if (!data) return res.status(404).json({ ok: false });
    return res.json({ ok: true, data: data.members });
}

export async function removeTopicMember(req, res) {
    try {
        const { slug, userId } = req.params;
        const requesterId = req.user?.id;
        if (!requesterId) {
            return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
        }

        // ── หา topic + owner ──────────────────────────────────────────────────────
        const [rowsTopic] = await pool.execute(
            "SELECT id, owner_id FROM topics WHERE slug = ? LIMIT 1",
            [slug]
        );
        if (rowsTopic.length === 0) {
            return res.status(404).json({ ok: false, error: "TOPIC_NOT_FOUND" });
        }
        const topicId = rowsTopic[0].id;
        const ownerId = rowsTopic[0].owner_id;

        // ── ระบุเป้าหมายที่จะลบ (รองรับ 'me') ───────────────────────────────────
        const targetId = userId === "me" ? requesterId : Number.parseInt(userId, 10);
        if (!Number.isInteger(targetId)) {
            return res.status(400).json({ ok: false, error: "INVALID_USER_ID" });
        }

        // ── ห้ามลบเจ้าของหัวข้อ ─────────────────────────────────────────────────
        if (targetId === ownerId) {
            return res.status(400).json({ ok: false, error: "CANNOT_REMOVE_OWNER" });
        }

        // ── ตรวจสิทธิ์: owner ลบใครก็ได้ (ยกเว้น owner) / ไม่ใช่ owner ลบได้เฉพาะตัวเอง ─
        const isOwner = requesterId === ownerId;
        const isSelfRemoval = requesterId === targetId;
        if (!isOwner && !isSelfRemoval) {
            return res.status(403).json({ ok: false, error: "FORBIDDEN" });
        }

        // ── ต้องมีความเป็นสมาชิกอยู่จริงก่อน ───────────────────────────────────
        const [rowsMember] = await pool.execute(
            "SELECT 1 FROM topic_members WHERE topic_id = ? AND user_id = ? LIMIT 1",
            [topicId, targetId]
        );
        if (rowsMember.length === 0) {
            return res.status(404).json({ ok: false, error: "MEMBER_NOT_FOUND" });
        }

        // ── ลบสมาชิกออกจากหัวข้อ ────────────────────────────────────────────────
        await pool.execute(
            "DELETE FROM topic_members WHERE topic_id = ? AND user_id = ?",
            [topicId, targetId]
        );

        // แนะนำ: 204 ไม่มีบอดี้ (หรือจะคืน json ก็ได้)
        return res.status(204).end();
        // หรือ:
        // return res.json({ ok: true, data: { topic_id: topicId, user_id: targetId } });
    } catch (err) {
        console.error("[removeTopicMember] error:", {
            code: err.code,
            errno: err.errno,
            sqlState: err.sqlState,
            sqlMessage: err.sqlMessage,
            message: err.message,
        });
        return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
    }
}