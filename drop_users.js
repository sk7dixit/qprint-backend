import pool from "./src/config/db.js";

async function drop() {
    try {
        console.log("Dropping users table...");
        await pool.query("DROP TABLE IF exists users CASCADE;");
        console.log("✅ Successfully dropped users table.");
        process.exit(0);
    } catch (err) {
        console.error("❌ Error dropping table:", err);
        process.exit(1);
    }
}

drop();
