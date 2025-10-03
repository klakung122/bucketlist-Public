import crypto from "crypto";
import pool from "../db.js";

export const urlSafeToken = (bytes = 24) =>
    crypto.randomBytes(bytes).toString("base64url");

export const sha256Hex = (s) =>
    crypto.createHash("sha256").update(s, "utf8").digest("hex");

export async function createInviteToken({ topicId, createdBy, maxUses, expiresAt }) {
    const tokenPlain = urlSafeToken();
    const tokenHash = sha256Hex(tokenPlain);

    const conn = await pool.getConnection();
    try {
        await conn.query(
            `INSERT INTO topic_tokens (topic_id, token_hash, token_type, max_uses, expires_at, created_by)
       VALUES (?, ?, 'invite', ?, ?, ?)`,
            [topicId, tokenHash, maxUses ?? null, expiresAt ?? null, createdBy]
        );
        return { tokenPlain, tokenHash };
    } finally {
        conn.release();
    }
}

export async function listInviteTokensByTopicId(topicId) {
    const conn = await pool.getConnection();
    try {
        const [rows] = await conn.query(
            `SELECT id, token_type, max_uses, used_count, expires_at, created_at
       FROM topic_tokens WHERE topic_id=? ORDER BY id DESC`, [topicId]
        );
        return rows;
    } finally {
        conn.release();
    }
}

export async function acceptInviteToken(tokenPlain, userId) {
    const tokenHash = sha256Hex(tokenPlain);
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // lock แถว token กันแข่งกันกดพร้อมกัน
        const [[tk]] = await conn.query(
            `SELECT tt.*, t.id AS topic_id
             FROM topic_tokens tt
             JOIN topics t ON t.id = tt.topic_id
             WHERE tt.token_hash=? AND tt.token_type='invite'
             FOR UPDATE`,
            [tokenHash]
        );
        if (!tk) {
            await conn.rollback();
            return { ok: false, error: "INVALID_TOKEN" };
        }

        const now = new Date();
        if (tk.expires_at && now > tk.expires_at) {
            await conn.rollback();
            return { ok: false, error: "EXPIRED" };
        }
        if (tk.max_uses !== null && tk.used_count >= tk.max_uses) {
            await conn.rollback();
            return { ok: false, error: "QUOTA_EXCEEDED" };
        }

        // พยายามเพิ่มสมาชิกด้วย INSERT IGNORE แล้วเช็คผล
        const [insertRes] = await conn.query(
            `INSERT IGNORE INTO topic_members (topic_id, user_id) VALUES (?, ?)`,
            [tk.topic_id, userId]
        );

        const joinedNow = insertRes.affectedRows === 1;

        if (joinedNow) {
            // ใช้แล้วลบทิ้ง (consume)
            await conn.query(
                `DELETE FROM topic_tokens WHERE id=?`,
                [tk.id]
            );
        }
        // ถ้า user เดิมอยู่แล้ว ไม่ลบ token (เผื่อส่งต่อให้คนอื่นใช้จริง)
        // ถ้าอยาก "ลบไม่ว่าคนเดิมหรือใหม่" ให้ย้าย DELETE มาข้างนอกแบบไม่เช็ค joinedNow

        await conn.commit();
        return { ok: true, topicId: tk.topic_id, consumed: joinedNow };
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
}