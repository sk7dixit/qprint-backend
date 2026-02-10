import admin from "../src/config/firebase-admin.js";
import pool from "../src/config/db.js";

/**
 * seedAdmin.js
 * Manual utility to create/verify the system admin.
 */
const seedAdmin = async () => {
    const adminEmail = "qprint92@gmail.com";
    const adminMobile = "8542929942";
    const adminPass = "Admin@123";

    console.log("🚀 Starting Admin Seeding...");

    try {
        let firebaseUser;
        try {
            // Check if user exists in Firebase
            firebaseUser = await admin.auth().getUserByEmail(adminEmail);
            console.log("✅ Admin already exists in Firebase Auth.");
        } catch (error) {
            if (error.code === "auth/user-not-found") {
                // Create user in Firebase
                firebaseUser = await admin.auth().createUser({
                    email: adminEmail,
                    password: adminPass,
                    displayName: "QPrint Admin",
                });
                console.log("✨ Admin created in Firebase Auth.");
            } else {
                throw error;
            }
        }

        // Set Custom Claims for extra leaf-level security (optional but good)
        await admin.auth().setCustomUserClaims(firebaseUser.uid, { role: "admin" });

        // Upsert into PostgreSQL
        const result = await pool.query(
            `INSERT INTO users (uid, email, mobile, name, role, is_profile_complete)
             VALUES ($1, $2, $3, $4, 'admin', true)
             ON CONFLICT (uid) 
             DO UPDATE SET role = 'admin', is_profile_complete = true, mobile = $3
             RETURNING *`,
            [firebaseUser.uid, adminEmail, adminMobile, "QPrint Admin"]
        );

        console.log("📦 Admin record synced in PostgreSQL:", result.rows[0].email);
        console.log("🎉 Seeding Complete. Admin is ready.");
        process.exit(0);
    } catch (error) {
        console.error("❌ Seeding Failed:", error);
        process.exit(1);
    }
};

seedAdmin();
