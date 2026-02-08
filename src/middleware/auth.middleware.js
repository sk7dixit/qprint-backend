import { verifyFirebaseToken } from "../config/firebase-admin.js";
import pool from "../config/db.js";

/**
 * Authenticate Middleware (Step 3)
 * Verifies the Firebase token and attaches the user from the PostgreSQL database.
 */
export const authenticate = async (req, res, next) => {
    const token = req.headers.authorization?.split("Bearer ")[1];

    console.log("🔍 [AUTH] Request to:", req.path);
    console.log("🔍 [AUTH] Token present:", !!token);

    if (!token) {
        console.log("❌ [AUTH] No token provided");
        return res.status(401).json({ error: "No token provided" });
    }

    try {
        console.log("🔍 [AUTH] Verifying token...");
        const decodedToken = await verifyFirebaseToken(token);
        console.log("✅ [AUTH] Token decoded. UID:", decodedToken.uid, "Email:", decodedToken.email);

        // Step E: Sync with database (Verify + Upsert)
        const result = await pool.query(
            "SELECT * FROM users WHERE uid = $1",
            [decodedToken.uid]
        );

        console.log("🔍 [AUTH] Database query result:", result.rows.length, "rows");

        let user;
        if (result.rows.length === 0) {
            // Fallback: Check by email (Claim Account logic)
            const emailCheck = await pool.query(
                "SELECT * FROM users WHERE email = $1",
                [decodedToken.email]
            );

            if (emailCheck.rows.length > 0) {
                console.log("ℹ️ [AUTH] User found by email. Updating UID...");
                // Update the existing user's UID to match the new token
                const updateResult = await pool.query(
                    "UPDATE users SET uid = $1 WHERE email = $2 RETURNING *",
                    [decodedToken.uid, decodedToken.email]
                );
                user = updateResult.rows[0];
                console.log("✅ [AUTH] Account claimed:", user.email, "Role:", user.role);
            } else {
                console.log("ℹ️ [AUTH] New user, creating record...");

                // Auto-promote Admin
                const role = decodedToken.email === "qprint92@gmail.com" ? "admin" : "student";
                const profileComplete = role === "admin"; // Admins don't need profile completion

                const insertResult = await pool.query(
                    `INSERT INTO users (uid, email, name, role, profile_complete) 
                     VALUES ($1, $2, $3, $4, $5) 
                     RETURNING *`,
                    [decodedToken.uid, decodedToken.email, decodedToken.name, role, profileComplete]
                );
                user = insertResult.rows[0];
                console.log("✅ [AUTH] User created:", user.email, "Role:", user.role);
            }
        } else {
            user = result.rows[0];

            // Auto-promote Admin if existing user has wrong role
            if (user.email === "qprint92@gmail.com" && user.role !== "admin") {
                console.log("⚠️ [AUTH] Promoting existing user to Admin...");
                const updateResult = await pool.query(
                    "UPDATE users SET role = 'admin', profile_complete = true WHERE id = $1 RETURNING *",
                    [user.id]
                );
                user = updateResult.rows[0];
            }

            console.log("✅ [AUTH] Existing user:", user.email, "Role:", user.role);
        }

        req.user = user;
        console.log("✅ [AUTH] Authentication successful");
        next();
    } catch (err) {
        console.error("❌ [AUTH] Middleware Error:", err.message);
        console.error("❌ [AUTH] Stack:", err.stack);
        return res.status(401).json({ error: "Invalid token" });
    }
};
