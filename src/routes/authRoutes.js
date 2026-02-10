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
    console.log("👉 /api/auth/google hit");
    try {
        const authHeader = req.headers.authorization;
        console.log("👉 Auth Header:", authHeader ? "Present" : "Missing");

        const token = authHeader?.split("Bearer ")[1];
        if (!token) {
            console.log("👉 No token found");
            return res.status(401).json({ error: "No token" });
        }

        console.log("👉 Verifying Firebase Token...");
        const decoded = await verifyFirebaseToken(token);
        console.log("👉 Token Verified. UID:", decoded.uid);

        const { uid, email, name: rawName, picture } = decoded;

        // BUG FIX: Handle missing email or rawName safely
        const safeEmail = email || "";
        const name = rawName || (safeEmail ? safeEmail.split("@")[0] : "User") || "User";

        let user;
        console.log(`👉 Checking/Creating user: ${safeEmail} (UID: ${uid})`);

        try {
            const existing = await pool.query(
                "SELECT * FROM users WHERE uid = $1",
                [uid]
            );

            if (existing.rows.length > 0) {
                console.log("👉 Existing user found by UID");
                user = existing.rows[0];
            } else {
                // Secondary check by email to claim pre-seeded accounts
                const existingByEmail = await pool.query(
                    "SELECT * FROM users WHERE email = $1",
                    [safeEmail]
                );

                if (existingByEmail.rows.length > 0) {
                    console.log("👉 User found by Email, linking UID...");
                    const updated = await pool.query(
                        "UPDATE users SET uid = $1, name = COALESCE(name, $2) WHERE email = $3 RETURNING *",
                        [uid, name, safeEmail]
                    );
                    user = updated.rows[0];
                } else {
                    console.log("👉 Creating new user record...");
                    const result = await pool.query(
                        `INSERT INTO users (uid, email, name, role, is_profile_complete)
                         VALUES ($1, $2, $3, 'student', false)
                         RETURNING *`,
                        [uid, safeEmail, name]
                    );
                    user = result.rows[0];
                }
            }
        } catch (dbError) {
            console.error("❌ Database Error during Auth Sync:", dbError);
            return res.status(500).json({
                error: "Database error during sync",
                details: dbError.message
            });
        }

        console.log("✅ Sync Successful for:", user.email, "Role:", user.role);
        res.json({
            success: true,
            user: {
                ...user,
                isProfileComplete: user.is_profile_complete // Alias for frontend consistency
            }
        });
    } catch (err) {
        console.error("❌ Auth Handshake Error:", err.code || err.message);

        if (err.code?.startsWith('auth/')) {
            return res.status(401).json({ error: "Firebase token verification failed", code: err.code });
        }

        res.status(500).json({ error: "Internal Server Error during handshake", details: err.message });
    }
});

router.post("/check-user", authenticate, checkUser);
router.post("/complete-profile", authenticate, completeProfile);
router.post("/clear-reset-flag", authenticate, clearResetFlag);

export default router;
