// controllers/invite.controller.js
import {
    createInviteToken,
    listInviteTokensByTopicId,
    acceptInviteToken,
} from "../services/token.js";
import pool from "../db.js";
import { getTopicBySlug, isOwnerOfTopicBySlug } from "../services/topics.js";
import { getIo, userRoom, topicRoom } from "../socket.js";
import { getTopicById, getTopicMemberIds } from "../helpers/topics.js";

export async function createInvite(req, res) {
    const { slug } = req.params;
    const userId = req.user.id;

    const can = await isOwnerOfTopicBySlug(slug, userId);
    if (!can) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const topic = await getTopicBySlug(slug);
    if (!topic) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const { maxUses = null, expiresInDays = 7 } = req.body || {};
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : null;

    const { tokenPlain } = await createInviteToken({
        topicId: topic.id,
        createdBy: userId,
        maxUses,
        expiresAt,
    });

    const inviteUrl = `${process.env.WEB_BASE_URL || "http://localhost:3000"}/join/${tokenPlain}`;
    return res.json({
        ok: true,
        data: { invite_url: inviteUrl, max_uses: maxUses ?? null, expires_at: expiresAt },
    });
}

export async function listInvites(req, res) {
    const { slug } = req.params;
    const userId = req.user.id;

    const can = await isOwnerOfTopicBySlug(slug, userId);
    if (!can) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const topic = await getTopicBySlug(slug);
    if (!topic) return res.status(404).json({ ok: false });

    const rows = await listInviteTokensByTopicId(topic.id);
    res.json({ ok: true, data: rows });
}

export async function acceptInvite(req, res) {
    const { token } = req.params;
    const userId = req.user.id;

    const result = await acceptInviteToken(token, userId);
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });

    // ⬇️ broadcast เฉพาะกรณี "เพิ่งเข้าร่วมจริง" (ไม่ใช่เป็นสมาชิกอยู่แล้ว)
    if (result.consumed) {
        const conn = await pool.getConnection();
        try {
            const topic = await getTopicById(conn, result.topicId);
            if (topic) {
                // 1) บอกผู้ที่เพิ่งเข้าร่วม → ให้ Sidebar โชว์หัวข้อใหม่ทันที
                getIo().to(userRoom(userId)).emit("topics:created", {
                    topic: {
                        id: topic.id,
                        title: topic.title,
                        description: topic.description,
                        slug: topic.slug,
                    },
                });

                // 2) บอกคนที่อยู่ในหน้า topic นี้/สมาชิกเดิม → มีสมาชิกใหม่เข้ามา
                //    2.1 broadcast ไปห้องของหน้า topic (คนที่เปิดอยู่จะเห็นทันที)
                getIo().to(topicRoom(topic.slug)).emit("members:added", {
                    slug: topic.slug,
                    user: { id: userId }, // จะใส่ username/avatar เพิ่มก็ได้ถ้ามี
                });

                //    2.2 (ออปชัน) บอก Sidebar ของสมาชิกเดิมทุกคนให้รีเฟรชจำนวนสมาชิก (ถ้าจำเป็น)
                // const memberIds = await getTopicMemberIds(conn, topic.id);
                // memberIds.forEach(uid => {
                //   getIo().to(userRoom(uid)).emit("topics:member_count_changed", {
                //     topicId: topic.id,
                //   });
                // });
            }
        } finally {
            conn.release();
        }
    }

    return res.json({ ok: true, data: { topic_id: result.topicId } });
}