// services/token.service.js
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

export async function deleteInviteTokenById({ topicId, tokenId }) {
    const conn = await pool.getConnection();
    try {
        const [r] = await conn.query(
            `DELETE FROM topic_tokens WHERE id=? AND topic_id=?`,
            [tokenId, topicId]
        );
        return r.affectedRows > 0;
    } finally {
        conn.release();
    }
}

export async function acceptInviteToken(tokenPlain, userId) {
    const tokenHash = sha256Hex(tokenPlain);
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

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

        const [[exists]] = await conn.query(
            `SELECT 1 FROM topic_members WHERE topic_id=? AND user_id=?`,
            [tk.topic_id, userId]
        );

        if (!exists) {
            await conn.query(
                `INSERT IGNORE INTO topic_members (topic_id, user_id) VALUES (?, ?)`,
                [tk.topic_id, userId]
            );
            await conn.query(
                `UPDATE topic_tokens SET used_count = used_count + 1 WHERE id=?`,
                [tk.id]
            );
        }

        await conn.commit();
        return { ok: true, topicId: tk.topic_id };
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
}