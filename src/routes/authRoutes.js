import express from "express";
import { verifyFirebaseToken } from "../config/firebase-admin.js";
import pool from "../config/db.js";
import { getProfile, checkUser, completeProfile, clearResetFlag, getMyShop } from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

// Profile Routes
router.get("/profile/:uid", authenticate, getProfile);
router.get("/my-shop", authenticate, getMyShop);

/**
 * Google Auth Endpoint (Step E)
 * Connects Firebase Identity to PostgreSQL.
 */
router.post("/google", async (req, res) => {
    try {
        const token = req.headers.authorization?.split("Bearer ")[1];
        if (!token) return res.status(401).json({ error: "No token" });

        const decoded = await verifyFirebaseToken(token);
        const { uid, email, name } = decoded;

        let user;
        const existing = await pool.query(
            "SELECT * FROM users WHERE uid = $1",
            [uid]
        );

        if (existing.rows.length > 0) {
            user = existing.rows[0];
        } else {
            // Check if user exists by email (to claim pre-seeded accounts)
            const existingByEmail = await pool.query(
                "SELECT * FROM users WHERE email = $1",
                [email]
            );

            if (existingByEmail.rows.length > 0) {
                // Update UID to match Firebase UID
                const updated = await pool.query(
                    "UPDATE users SET uid = $1 WHERE email = $2 RETURNING *",
                    [uid, email]
                );
                user = updated.rows[0];
            } else {
                const result = await pool.query(
                    `INSERT INTO users (uid, email, name, role, profile_complete)
                     VALUES ($1, $2, $3, 'student', false)
                     RETURNING *`,
                    [uid, email, name]
                );
                user = result.rows[0];
            }
        }

        res.json({
            success: true,
            profile_complete: user.profile_complete,
            role: user.role
        });
    } catch (err) {
        console.error("Auth Error:", err);
        res.status(401).json({ error: "Invalid token" });
    }
});

router.post("/check-user", authenticate, checkUser);
router.post("/complete-profile", authenticate, completeProfile);
router.post("/clear-reset-flag", authenticate, clearResetFlag);

export default router;
