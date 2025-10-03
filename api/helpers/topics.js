export async function getTopicSlugById(conn, topicId) {
    const [[row]] = await conn.query("SELECT slug FROM topics WHERE id = ? LIMIT 1", [topicId]);
    return row?.slug || null;
}

export async function getTopicById(conn, topicId) {
    const [[row]] = await conn.query(
        `SELECT id, title, description, slug, owner_id FROM topics WHERE id = ? LIMIT 1`,
        [topicId]
    );
    return row || null;
}

export async function getTopicMemberIds(conn, topicId) {
    const [rows] = await conn.query(
        `SELECT user_id FROM topic_members WHERE topic_id = ?`,
        [topicId]
    );
    return rows.map(r => r.user_id);
}