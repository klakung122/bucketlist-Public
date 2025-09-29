// controllers/invite.controller.js
import {
    createInviteToken,
    listInviteTokensByTopicId,
    deleteInviteTokenById,
    acceptInviteToken,
} from "../services/token.js";
import { getTopicBySlug, isOwnerOfTopicBySlug } from "../services/topics.js";

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

    return res.json({ ok: true, data: { topic_id: result.topicId } });
}