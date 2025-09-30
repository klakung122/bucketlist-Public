import { Router } from "express";
import {
    updateListStatus,
    updateList,
    deleteList
} from "../controllers/listsController.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();
router.patch("/:id/status", requireAuth, updateListStatus);
router.patch("/:id", requireAuth, updateList);
router.delete("/:id", requireAuth, deleteList);

export default router;