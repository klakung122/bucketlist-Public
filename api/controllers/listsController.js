// api/controllers/listsController.js
import pool from "../db.js";

// PATCH /lists/:id   { status: "active" | "archived" }
export async function updateListStatus(req, res) {
    const { id } = req.params;
    const { status } = req.body || {};
    if (status !== "active" && status !== "archived") {
        return res.status(400).json({ ok: false, error: "INVALID_STATUS" });
    }
    try {
        const [result] = await pool.query(
            "UPDATE lists SET status = ? WHERE id = ?",
            [status, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ ok: false, error: "NOT_FOUND" });
        }
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
    }
}