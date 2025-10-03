// api/helpers/socket-broadcast.js
import { getIo, userRoom } from "../socket.js";

// ดึง user_ids ของสมาชิกทั้งหมดในหัวข้อ
export async function getTopicMemberIds(conn, topicId) {
    const [rows] = await conn.query(
        "SELECT user_id FROM topic_members WHERE topic_id = ?",
        [topicId]
    );
    return rows.map(r => r.user_id);
}

// ยิง event ไปยัง user room ของ userIds ทั้งหมด
export function emitToUsers(userIds, event, payload) {
    const io = getIo();
    userIds.forEach(uid => {
        io.to(userRoom(uid)).emit(event, payload);
    });
}