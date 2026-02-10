import pool from "../config/db.js";

export const getProfile = async (req, res) => {
    const { uid } = req.params;
    try {
        let result = await pool.query("SELECT * FROM users WHERE uid = $1", [uid]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error("Error fetching profile:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const checkUser = async (req, res) => {
    if (!req.user.profile_complete) {
        return res.status(409).json({ next: "onboarding" });
    }
    res.status(200).json({ next: "dashboard" });
};

export const completeProfile = async (req, res) => {
    const { enrollmentId, mobile } = req.body;

    if (!enrollmentId || !mobile) {
        return res.status(400).json({ error: "Missing enrollmentId or mobile" });
    }

    try {
        const { enrollmentId, mobile } = req.body;

        if (!enrollmentId || !mobile) {
            return res.status(400).json({ error: "Missing enrollmentId or mobile" });
        }

        // Server-side validation for ID length logic
        if (enrollmentId.length !== 5 && enrollmentId.length < 10) {
            return res.status(400).json({ error: "Invalid ID format. Must be 5 digits (Staff) or 10+ digits (Student)." });
        }

        // Determine role based on ID length
        let newRole = req.user.role;
        if (enrollmentId.length === 5) {
            newRole = 'staff';
        } else if (enrollmentId.length >= 10) {
            newRole = 'student';
        }

        const query = `
            UPDATE users
            SET
                enrollment_id = $1,
                mobile = $2,
                profile_complete = true,
                role = $3
            WHERE id = $4
            RETURNING *;
        `;

        const result = await pool.query(query, [enrollmentId, mobile, newRole, req.user.id]);
        res.status(200).json({ success: true, user: result.rows[0] });
    } catch (error) {
        console.error("Error completing profile:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
import admin from "firebase-admin";

export const clearResetFlag = async (req, res) => {
    const { uid } = req.user;

    try {
        // 1. Update DB (Persistent for Dev Mode)
        await pool.query("UPDATE users SET force_password_reset = false WHERE uid = $1", [uid]);

        // 2. Clear Firebase Claims (Production)
        // Fetch existing claims to preserve role and shopId
        const user = await admin.auth().getUser(uid);
        const existingClaims = user.customClaims || {};

        await admin.auth().setCustomUserClaims(uid, {
            ...existingClaims,
            forcePasswordReset: false
        });

        res.status(200).json({ success: true, message: "Security flag cleared. Proceed to dashboard." });
    } catch (error) {
        console.error("Error clearing reset flag:", error);
        res.status(500).json({ error: "Failed to update security claims" });
    }
};

export const getMyShop = async (req, res) => {
    const { shop_id } = req.user;

    if (!shop_id) {
        return res.status(404).json({ error: "No shop associated with this account." });
    }

    try {
        const result = await pool.query("SELECT * FROM shops WHERE id = $1", [shop_id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Shop record not found." });
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error("Error fetching shop profile:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
