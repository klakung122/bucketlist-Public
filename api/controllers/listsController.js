import pool from "../db.js";
import { z } from "zod";
import { getIo, topicRoom } from "../socket.js";
import { getTopicSlugById } from "../helpers/topics.js";

const bodySchema = z.object({
    status: z.enum(["active", "archived"]),
});

export async function updateListStatus(req, res) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const listId = Number(req.params.id);
    if (!Number.isInteger(listId) || listId <= 0) {
        return res.status(400).json({ ok: false, error: "BAD_ID" });
    }

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ ok: false, error: "BAD_BODY" });
    }
    const { status } = parsed.data;

    const conn = await pool.getConnection();
    try {
        // ดึง list + topic
        const [[list]] = await conn.query(
            `SELECT l.id, l.topic_id, l.status
         FROM lists l
        WHERE l.id = ?`,
            [listId]
        );
        if (!list) return res.status(404).json({ ok: false, error: "LIST_NOT_FOUND" });

        // อนุญาต owner หรือ member
        const [[auth]] = await conn.query(
            `
      SELECT 1
        FROM topics t
        LEFT JOIN topic_members tm
               ON tm.topic_id = t.id AND tm.user_id = ?
       WHERE t.id = ? AND (t.owner_id = ? OR tm.user_id IS NOT NULL)
       LIMIT 1
      `,
            [userId, list.topic_id, userId]
        );
        if (!auth) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

        if (list.status === status) {
            return res.json({ ok: true, data: { id: list.id, status } });
        }

        await conn.query(`UPDATE lists SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [status, listId]);

        // 🔔 broadcast
        try {
            const slug = await getTopicSlugById(conn, list.topic_id);
            if (slug) {
                getIo().to(topicRoom(slug)).emit("lists:updated", {
                    slug,
                    list: { id: listId, status },
                });
            }
        } catch { }

        return res.json({ ok: true, data: { id: listId, status } });
    } catch (err) {
        console.error("updateListStatus error:", err);
        return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
    } finally {
        conn.release();
    }
}

export async function updateList(req, res) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const listId = Number(req.params.id);
    if (!Number.isFinite(listId)) return res.status(400).json({ ok: false, error: "BAD_LIST_ID" });

    // รับอินพุต (optional fields)
    let { title, description, status } = req.body ?? {};
    if (typeof title === "string") title = title.trim();
    if (description === "") description = null; // ว่างให้เก็บเป็น null
    if (typeof description === "string") description = description; // keep text/null

    // validate status ถ้าส่งมา
    if (status !== undefined && status !== "active" && status !== "archived") {
        return res.status(400).json({ ok: false, error: "BAD_STATUS" });
    }

    // ไม่มีฟิลด์อะไรให้แก้เลย
    if (title === undefined && description === undefined && status === undefined) {
        return res.status(400).json({ ok: false, error: "NO_FIELDS" });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1) ดึง list + topic_id
        const [rows] = await conn.query(
            `SELECT l.id, l.topic_id, l.title, l.status
         FROM lists l
        WHERE l.id = ? FOR UPDATE`,
            [listId]
        );
        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ ok: false, error: "LIST_NOT_FOUND" });
        }
        const list = rows[0];

        // 2) ตรวจสิทธิ์: ต้องเป็นสมาชิกของหัวข้อ (หรือ owner)
        // ปรับชื่อตารางให้ตรงกับของจริงถ้าใช้ชื่ออื่น เช่น topic_members
        const [auth] = await conn.query(
            `
      SELECT 1
        FROM topics t
        LEFT JOIN topic_members tm ON tm.topic_id = t.id AND tm.user_id = ?
       WHERE t.id = ? AND (t.owner_id = ? OR tm.user_id IS NOT NULL)
       LIMIT 1
      `,
            [userId, list.topic_id, userId]
        );
        if (auth.length === 0) {
            await conn.rollback();
            return res.status(403).json({ ok: false, error: "FORBIDDEN" });
        }

        // 3) ถ้าจะเปลี่ยน title → เช็คซ้ำภายใน topic เดียวกัน
        if (title !== undefined && title !== list.title) {
            if (!title) {
                await conn.rollback();
                return res.status(400).json({ ok: false, error: "TITLE_REQUIRED" });
            }
            if (title.length > 200) {
                await conn.rollback();
                return res.status(400).json({ ok: false, error: "TITLE_TOO_LONG" });
            }

            const [dup] = await conn.query(
                `SELECT 1
           FROM lists
          WHERE topic_id = ? AND title = ? AND id <> ?
          LIMIT 1`,
                [list.topic_id, title, listId]
            );
            if (dup.length > 0) {
                await conn.rollback();
                return res.status(409).json({ ok: false, error: "DUPLICATE_TITLE" });
            }
        }

        // 4) สร้าง SET แบบไดนามิกเฉพาะฟิลด์ที่ส่งมา
        const sets = [];
        const args = [];

        if (title !== undefined) { sets.push("title = ?"); args.push(title); }
        if (description !== undefined) { sets.push("description = ?"); args.push(description); }
        if (status !== undefined) { sets.push("status = ?"); args.push(status); }

        if (sets.length === 0) {
            await conn.rollback();
            return res.status(400).json({ ok: false, error: "NO_FIELDS" });
        }

        sets.push("updated_at = CURRENT_TIMESTAMP");

        await conn.query(
            `UPDATE lists SET ${sets.join(", ")} WHERE id = ?`,
            [...args, listId]
        );

        await conn.commit();

        // ดึงค่าใหม่กลับไปให้ frontend
        const [after] = await conn.query(
            `SELECT id, topic_id, title, description, status, position, created_by, created_at, updated_at
         FROM lists
        WHERE id = ?`,
            [listId]
        );

        // 🔔 broadcast
        try {
            const slug = await getTopicSlugById(conn, after[0].topic_id);
            if (slug) {
                getIo().to(topicRoom(slug)).emit("lists:updated", {
                    slug,
                    list: {
                        id: after[0].id,
                        title: after[0].title,
                        description: after[0].description,
                        status: after[0].status,
                    },
                });
            }
        } catch { }

        return res.json({ ok: true, data: after[0] });
    } catch (err) {
        console.error(err);
        try { await conn.rollback(); } catch { }
        // กันเคสชน unique key (topic_id, title) เผื่อเล็ดรอดมาจาก unique constraint
        if (err?.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ ok: false, error: "DUPLICATE_TITLE" });
        }
        return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
    } finally {
        conn.release();
    }
}

export async function deleteList(req, res) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const listId = Number(req.params.id);
    if (!Number.isInteger(listId) || listId <= 0) {
        return res.status(400).json({ ok: false, error: "BAD_ID" });
    }

    const conn = await pool.getConnection();
    try {
        // ดึง topic_id ก่อน
        const [[list]] = await conn.query(
            `SELECT l.id, l.topic_id FROM lists l WHERE l.id = ?`,
            [listId]
        );
        if (!list) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

        // อนุญาต owner หรือ member
        const [[auth]] = await conn.query(
            `
      SELECT 1
        FROM topics t
        LEFT JOIN topic_members tm
               ON tm.topic_id = t.id AND tm.user_id = ?
       WHERE t.id = ? AND (t.owner_id = ? OR tm.user_id IS NOT NULL)
       LIMIT 1
      `,
            [userId, list.topic_id, userId]
        );
        if (!auth) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

        await conn.query(`DELETE FROM lists WHERE id = ?`, [listId]);

        // 🔔 broadcast
        try {
            const slug = await getTopicSlugById(conn, list.topic_id);
            if (slug) {
                getIo().to(topicRoom(slug)).emit("lists:deleted", { slug, id: listId });
            }
        } catch { }

        return res.json({ ok: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
    } finally {
        conn.release();
    }
}