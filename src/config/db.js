import pg from "pg";
import { env } from "./env.js";

const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
});

pool.on("connect", () => {
    console.log("✅ Neon DB connected successfully");
});

pool.on("error", (err) => {
    console.error("❌ Unexpected error on idle client", err);
    process.exit(-1);
});

export const initDb = async () => {
    try {
        // Shops Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS shops (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                location VARCHAR(255),
                owner_uid VARCHAR(255), -- Firebase UID
                upi_id VARCHAR(255),
                phone VARCHAR(20),
                email VARCHAR(255),
                verification_status VARCHAR(50) DEFAULT 'VERIFIED',
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Ensure at least one seller is assigned to a shop for the demo
        await pool.query(`
            UPDATE users SET shop_id = 1 WHERE role = 'seller' AND shop_id IS NULL;
        `);

        console.log("✅ Users table checked/created");

        console.log("✅ Users table checked/created");
    } catch (error) {
        console.error("❌ Error initializing DB tables:", error);
    }
};

export default pool;
