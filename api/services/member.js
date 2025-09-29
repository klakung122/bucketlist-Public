// services/member.service.js
import pool from "../db.js";

export async function listMembersByTopicSlug(slug) {
    const conn = await pool.getConnection();
    try {
        const [[t]] = await conn.query(`SELECT id FROM topics WHERE slug=?`, [slug]);
        if (!t) return null;

        const [rows] = await conn.query(
            `SELECT u.id, u.username, u.email, u.profile_image
       FROM topic_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.topic_id=?
       ORDER BY tm.joined_at ASC`,
            [t.id]
        );
        return { topicId: t.id, members: rows };
    } finally {
        conn.release();
    }
}