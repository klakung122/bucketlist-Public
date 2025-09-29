// routes/invites.routes.js
import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import {
    createInvite,
    listInvites,
    acceptInvite,
} from "../controllers/inviteController.js";

const router = Router();

// owner only
router.post("/topics/:slug/invites", requireAuth, createInvite);
router.get("/topics/:slug/invites", requireAuth, listInvites);

// accept
router.post("/invites/:token/accept", requireAuth, acceptInvite);

export default router;