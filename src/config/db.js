import pg from "pg";
import { env } from "./env.js";

const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: 10, // Limit to 10 connections per instance (Safe for Neon free tier with 2-4 instances)
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

pool.on("connect", () => {
    console.log("✅ Neon DB connected successfully");
});

pool.on("error", (err) => {
    console.error("❌ Unexpected DB error:", err);
});

export const initDb = async () => {
    console.info("ℹ️ Database initialization: Schema is managed via migrations in scripts/.");
    // Runtime schema creation removed for stability and scaling.
};

export const db = pool;
export default pool;
