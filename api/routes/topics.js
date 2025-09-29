// api/routes/topics.js
import { Router } from "express";
import {
    listTopics,
    createTopic,
    getTopicBySlug,
    listListsByTopicSlug,
    createListByTopicSlug,
    listOwnedTopics,
    updateTopicTitleOwnerOnly,
    deleteTopicOwnerOnly,
    listTopicMembers
} from "../controllers/topicsController.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

router.get("/", listTopics);
router.get("/owned", listOwnedTopics);
router.get("/:slug/members", requireAuth, listTopicMembers);
router.post("/", createTopic);
router.get("/:slug", getTopicBySlug);
router.get("/:slug/lists", listListsByTopicSlug);
router.post("/:slug/lists", createListByTopicSlug);
router.patch("/:id", updateTopicTitleOwnerOnly);
router.delete("/:id", deleteTopicOwnerOnly);

export default router;