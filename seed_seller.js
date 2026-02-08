
import pool from "./src/config/db.js";

const seedSeller = async () => {
    const email = "shashwatdixit33@gmail.com";
    const tempUid = "manual-seed-" + Date.now();
    const name = "Shashwat Dixit";

    try {
        console.log(`Seeding seller account for ${email}...`);

        // Check if exists by email
        const check = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

        if (check.rows.length > 0) {
            const user = check.rows[0];
            console.log(`User already exists (ID: ${user.id}). Updating role to 'seller'...`);
            await pool.query("UPDATE users SET role = 'seller' WHERE id = $1", [user.id]);
            console.log("✅ User role updated to SELLER.");
        } else {
            console.log("Creating new user...");
            await pool.query(
                `INSERT INTO users (uid, email, name, role, profile_complete)
                 VALUES ($1, $2, $3, 'seller', true)`,
                [tempUid, email, name]
            );
            console.log(`✅ User created with TEMP UID: ${tempUid}`);
            console.log("NOTE: When the user logs in via Firebase with this email, the UID will be automatically updated.");
        }

    } catch (err) {
        console.error("❌ Error seeding seller:", err);
    } finally {
        await pool.end();
    }
};

seedSeller();
