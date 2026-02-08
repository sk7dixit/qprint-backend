/**
 * Order Controller - Handles print orders and queue logic
 */
import pool from "../config/db.js";

export const createOrder = async (req, res) => {
    const { shop_id, file_id } = req.body;

    if (!shop_id || !file_id) {
        return res.status(400).json({ error: "Missing shop_id or file_id" });
    }

    try {
        // Queue Logic: Per shop, per day
        const queueQuery = `
            SELECT COUNT(*) FROM orders
            WHERE shop_id = $1
            AND DATE(created_at) = CURRENT_DATE
        `;
        const queueResult = await pool.query(queueQuery, [shop_id]);
        const queueNumber = Number(queueResult.rows[0].count) + 1;

        // Insert Order
        const insertQuery = `
            INSERT INTO orders (user_id, shop_id, file_id, queue_number, status)
            VALUES ($1, $2, $3, $4, 'queued')
            RETURNING *;
        `;
        const orderResult = await pool.query(insertQuery, [req.user.id, shop_id, file_id, queueNumber]);

        res.status(201).json({
            success: true,
            order: orderResult.rows[0],
            message: `Order created. Your queue number is ${queueNumber}.`
        });
    } catch (error) {
        console.error("Order creation error:", error);
        res.status(500).json({ error: "Failed to create order" });
    }
};

export const getMyOrders = async (req, res) => {
    try {
        const query = `
            SELECT o.*, s.name AS shop_name, f.filename, f.file_url 
            FROM orders o
            JOIN shops s ON o.shop_id = s.id
            JOIN files f ON o.file_id = f.id
            WHERE o.user_id = $1
            ORDER BY o.created_at DESC
        `;
        const result = await pool.query(query, [req.user.id]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Fetch orders error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getActiveShops = async (req, res) => {
    try {
        // For Step 8 demo: also join current queue length
        const query = `
            SELECT s.*, 
            (SELECT COUNT(*) FROM orders o WHERE o.shop_id = s.id AND o.status IN ('queued', 'accepted', 'printing') AND DATE(o.created_at) = CURRENT_DATE) as queue_length
            FROM shops s
            WHERE is_active = true
        `;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Fetch shops error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getShopOrders = async (req, res) => {
    try {
        const query = `
            SELECT o.*, u.display_name, f.filename
            FROM orders o
            JOIN users u ON o.user_id = u.id
            JOIN files f ON o.file_id = f.id
            WHERE o.shop_id = $1
            AND DATE(o.created_at) = CURRENT_DATE
            ORDER BY o.queue_number ASC
        `;
        // req.user has been hydrated from db, so shop_id should be present
        const result = await pool.query(query, [req.user.shop_id]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Fetch shop orders error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const updateOrderStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['queued', 'accepted', 'printing', 'ready', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
    }

    try {
        const query = `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *;`;
        const result = await pool.query(query, [status, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Order not found" });
        }

        res.status(200).json({ success: true, order: result.rows[0] });
    } catch (error) {
        console.error("Update status error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
