import express from "express";
import pool from "../config/db.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

// Get specific shop details (for seller)
router.get("/:id", authenticate, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM shops WHERE id = $1", [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Shop not found" });
        res.status(200).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// Update shop status (Open/Closed)
router.patch("/:id/status", authenticate, async (req, res) => {
    const { is_open } = req.body;
    try {
        const query = "UPDATE shops SET is_open = $1 WHERE id = $2 RETURNING *";
        const result = await pool.query(query, [is_open, req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Shop not found" });
        res.status(200).json({ success: true, shop: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: "Failed to update status" });
    }
});

// Update shop pricing
router.patch("/:id/pricing", authenticate, async (req, res) => {
    const { price_bw_a4, price_color_a4 } = req.body;
    try {
        const query = "UPDATE shops SET price_bw_a4 = $1, price_color_a4 = $2 WHERE id = $3 RETURNING *";
        const result = await pool.query(query, [price_bw_a4, price_color_a4, req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Shop not found" });
        res.status(200).json({ success: true, shop: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: "Failed to update pricing" });
    }
});

export default router;
