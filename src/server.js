import { createServer } from "http";
import app from "./app.js";
import { env } from "./config/env.js";
import pool, { initDb } from "./config/db.js";
import { initSocket } from "./services/socketService.js";
import { initNotificationListener } from "./queue/notificationListener.js"; // Import listener

const httpServer = createServer(app);
const io = initSocket(httpServer);

const startServer = async () => {
    try {
        // Test DB connection
        await pool.query("SELECT 1");

        // Initialize Tables
        await initDb();
        console.log("🔥 API running on process:", process.pid); // PID Log for LB Check
        httpServer.listen(env.PORT, () => {
            console.log(`🚀 Server running on port ${env.PORT}`);
        });

        // Start Queue Listener
        initNotificationListener();
    } catch (error) {
        console.error("❌ Failed to start server:", error);
        process.exit(1);
    }
};

startServer();

// Trigger restart 2
