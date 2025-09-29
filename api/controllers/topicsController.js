// api/controllers/topicsController.js
import pool from "../db.js";

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
    const ownerId = req.user?.id || 1; // TODO: ใช้ค่าจริงจาก JWT

    if (!title || !title.trim()) {
        return res.status(400).json({ ok: false, error: "TITLE_REQUIRED" });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // --- หา username (เหมือนเดิม) ---
        let username = req.user?.username;
        if (!username) {
            const [urows] = await conn.query(
                "SELECT username FROM users WHERE id = ? LIMIT 1",
                [ownerId]
            );
            username = urows?.[0]?.username || "user";
        }

        // --- สร้าง slug (เหมือนเดิม) ---
        const usernameSlug = slugify(username);
        const shuffled = shuffleString(usernameSlug || "user");
        const token = randomBase62(8);
        const base = `${(shuffled || "user").slice(0, 8)}-${token}`.toLowerCase();
        const baseCapped = base.slice(0, 64);
        const uniqueSlug = await ensureUniqueSlug(baseCapped, conn);

        // --- INSERT topics ---
        const [result] = await conn.query(
            `INSERT INTO topics (title, description, owner_id, slug)
       VALUES (?, ?, ?, ?)`,
            [title.trim(), description ?? null, ownerId, uniqueSlug]
        );

        const topicId = result.insertId;

        // --- INSERT topic_members: ใส่เจ้าของเป็นสมาชิกทันที ---
        // PK (topic_id, user_id) ช่วยกันซ้ำให้เอง
        await conn.query(
            `INSERT INTO topic_members (topic_id, user_id)
       VALUES (?, ?)`,
            [topicId, ownerId]
        );

        await conn.commit();

        return res.status(201).json({
            ok: true,
            data: { id: topicId, title: title.trim(), slug: uniqueSlug },
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

// controllers/topicsController.js
export async function getTopicBySlug(req, res) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const conn = await pool.getConnection();
    try {
        const check = await requireMemberBySlug(conn, userId, req.params.slug);
        if (check.error === "TOPIC_NOT_FOUND")
            return res.status(404).json({ ok: false, error: "NOT_FOUND" });
        if (check.error === "FORBIDDEN")
            return res.status(403).json({ ok: false, error: "FORBIDDEN" });

        const [[row]] = await conn.query(
            "SELECT id, title, slug FROM topics WHERE id = ? LIMIT 1",
            [check.topicId]
        );
        res.json({ ok: true, data: row });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
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
            `SELECT id, title, status, position, created_at
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

        // ลบหัวข้อ (FK จะลบ lists / topic_members ที่ผูกแบบ CASCADE ให้ ตาม schema)
        await conn.query("DELETE FROM topics WHERE id = ?", [id]);

        await conn.commit();
        res.json({ ok: true });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
    } finally {
        conn.release();
    }
}