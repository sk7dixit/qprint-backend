import express from "express";
import { verifyFirebaseToken } from "../config/firebase-admin.js";
import { db } from "../config/db.js";
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
    const timestamp = new Date().toISOString();
    console.log(`\n🔑 [${timestamp}] AUTH SYNC ATTEMPT`);
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            console.log("❌ [Auth] Authorization header missing or malformed");
            return res.status(401).json({ error: "Missing or invalid authorization header" });
        }

        const token = authHeader.split("Bearer ")[1];
        if (!token || token === 'undefined' || token === 'null') {
            console.log("❌ [Auth] Null/Undefined token received");
            return res.status(400).json({ error: "Invalid token format" });
        }

        console.log("👉 [Auth] Verifying Firebase Token...");
        const decoded = await verifyFirebaseToken(token);
        console.log(`👉 [Auth] Token Verified. UID: ${decoded.uid}, Email: ${decoded.email}`);

        const { uid, email, name: rawName } = decoded;

        if (!email) {
            console.warn("⚠️ [Auth] Warning: User has no email in Firebase token");
        }

        const safeEmail = email || "";
        const name = rawName || (safeEmail ? safeEmail.split("@")[0] : "User") || "User";

        let user;
        console.log(`👉 [Auth] Syncing DB for: ${safeEmail || uid}`);

        try {
            // First check by UID
            const existing = await db.query(
                "SELECT * FROM users WHERE uid = $1",
                [uid]
            );

            if (existing.rows.length > 0) {
                console.log("👉 [Auth] User matched by UID");
                user = existing.rows[0];
            } else if (safeEmail) {
                // Secondary check by email to claim pre-seeded accounts
                const existingByEmail = await db.query(
                    "SELECT * FROM users WHERE email = $1",
                    [safeEmail]
                );

                if (existingByEmail.rows.length > 0) {
                    console.log("👉 [Auth] User matched by Email, linking UID...");
                    const updated = await db.query(
                        "UPDATE users SET uid = $1, name = COALESCE(name, $2) WHERE email = $3 RETURNING *",
                        [uid, name, safeEmail]
                    );
                    user = updated.rows[0];
                } else {
                    console.log("👉 [Auth] Creating new student record...");
                    const result = await db.query(
                        `INSERT INTO users (uid, email, name, role, is_profile_complete)
                         VALUES ($1, $2, $3, 'student', false)
                         RETURNING *`,
                        [uid, safeEmail, name]
                    );
                    user = result.rows[0];
                }
            } else {
                // No email, no UID match, create by UID only (rare for Google Auth)
                console.log("👉 [Auth] Creating new user by UID only (No email found)...");
                const result = await db.query(
                    `INSERT INTO users (uid, name, role, is_profile_complete)
                     VALUES ($1, $2, 'student', false)
                     RETURNING *`,
                    [uid, name]
                );
                user = result.rows[0];
            }
        } catch (dbError) {
            console.error("❌ [Auth] Database Sync Error:", dbError.message);
            return res.status(500).json({
                error: "Authentication database synchronization failed",
                details: dbError.message
            });
        }

        console.log(`✅ [Auth] Sync Completed: ${user.email || user.uid} (Role: ${user.role})`);
        res.json({
            success: true,
            user: {
                ...user,
                isProfileComplete: user.is_profile_complete
            }
        });
    } catch (err) {
        console.error("❌ [Auth] Critical Handshake Failure:", err.message);

        const status = err.code?.startsWith('auth/') ? 401 : 500;
        const message = err.code?.startsWith('auth/')
            ? "Firebase session expired or invalid"
            : "Internal Server Error during auth handshake";

        res.status(status).json({
            error: message,
            code: err.code,
            details: err.message
        });
    }
});

router.post("/check-user", authenticate, checkUser);
router.post("/complete-profile", authenticate, completeProfile);
router.post("/clear-reset-flag", authenticate, clearResetFlag);

export default router;
