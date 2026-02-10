import { createServer } from "http";
import app from "./app.js";
import { env } from "./config/env.js";
import pool, { initDb } from "./config/db.js";
import { initSocket } from "./services/socketService.js";

const httpServer = createServer(app);
const io = initSocket(httpServer);

const startServer = async () => {
    try {
        // Test DB connection
        await pool.query("SELECT 1");

        // Initialize Tables
        await initDb();

        httpServer.listen(env.PORT, () => {
            console.log(`🚀 Server running on port ${env.PORT}`);
        });
    } catch (error) {
        console.error("❌ Failed to start server:", error);
        process.exit(1);
    }
};

startServer();

// Trigger restart
