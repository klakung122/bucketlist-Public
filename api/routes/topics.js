// api/routes/topics.js
import { Router } from "express";
import {
    listTopics,
    createTopic,
    getTopicBySlug,
    listListsByTopicSlug,
    createListByTopicSlug
} from "../controllers/topicsController.js";

const router = Router();

router.get("/", listTopics);
router.post("/", createTopic);
router.get("/:slug", getTopicBySlug);
router.get("/:slug/lists", listListsByTopicSlug);
router.post("/:slug/lists", createListByTopicSlug);

export default router;