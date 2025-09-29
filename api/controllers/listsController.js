import pool from "../db.js";
import { z } from "zod";

const bodySchema = z.object({
    status: z.enum(["active", "archived"]),
});

export async function updateListStatus(req, res) {
    const userId = req.user?.id; // มาจาก requireAuth
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
        // 1) เช็คว่า list นี้อยู่ใน topic ที่ user เป็นสมาชิก
        const [[row]] = await conn.query(
            `SELECT l.id, l.status, l.topic_id
         FROM lists l
         JOIN topic_members m
           ON m.topic_id = l.topic_id
          AND m.user_id = ?
        WHERE l.id = ?
        LIMIT 1`,
            [userId, listId]
        );

        if (!row) {
            // ไม่พบรายการ หรือไม่มีสิทธิ์เข้าถึง
            return res.status(404).json({ ok: false, error: "NOT_FOUND_OR_FORBIDDEN" });
        }

        // 2) ถ้าค่าเดิมเท่าเดิม ก็ส่งกลับเลย
        if (row.status === status) {
            return res.json({ ok: true, data: { id: row.id, status } });
        }

        // 3) อัปเดตสถานะ
        await conn.query(`UPDATE lists SET status = ? WHERE id = ?`, [status, listId]);

        return res.json({ ok: true, data: { id: listId, status } });
    } catch (err) {
        console.error("updateListStatus error:", err);
        return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
    } finally {
        conn.release();
    }
}

export async function deleteList(req, res) {
    const userId = req.user?.id;
    const listId = Number(req.params.id);
    const conn = await pool.getConnection();
    try {
        const [[row]] = await conn.query(
            `SELECT l.id
         FROM lists l
         JOIN topic_members m ON m.topic_id = l.topic_id
        WHERE l.id = ? AND m.user_id = ?`,
            [listId, userId]
        );
        if (!row) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

        await conn.query("DELETE FROM lists WHERE id = ?", [listId]);
        res.json({ ok: true });
    } finally {
        conn.release();
    }
}