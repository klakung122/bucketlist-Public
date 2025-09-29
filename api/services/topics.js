// services/topic.service.js
import pool from "../db.js";

export async function getTopicBySlug(slug, conn = null) {
    const c = conn || (await pool.getConnection());
    try {
        const [[row]] = await c.query("SELECT * FROM topics WHERE slug=?", [slug]);
        return row || null;
    } finally {
        if (!conn) c.release();
    }
}

export async function isOwnerOfTopicBySlug(slug, userId) {
    const conn = await pool.getConnection();
    try {
        const [[row]] = await conn.query(
            "SELECT 1 FROM topics WHERE slug=? AND owner_id=?",
            [slug, userId]
        );
        return !!row;
    } finally {
        conn.release();
    }
}