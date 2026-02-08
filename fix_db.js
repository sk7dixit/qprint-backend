import pool from "./src/config/db.js";

async function fix() {
    try {
        console.log("Adding id column to users table...");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS id SERIAL PRIMARY KEY;");
        console.log("✅ Successfully added id column.");
        process.exit(0);
    } catch (err) {
        console.error("❌ Error fixing DB:", err);
        process.exit(1);
    }
}

fix();
