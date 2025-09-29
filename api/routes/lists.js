import { Router } from "express";
import {
    updateListStatus,
    deleteList
} from "../controllers/listsController.js";

const router = Router();
router.patch("/:id", updateListStatus);
router.delete("/:id", deleteList)

export default router;