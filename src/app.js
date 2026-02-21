import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import fileRoutes from "./routes/fileRoutes.js";
import pdfRoutes from "./routes/pdfRoutes.js";
import printJobRoutes from "./routes/printJobRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import shopRoutes from "./routes/shopRoutes.js";
import printDraftRoutes from "./routes/printDraftRoutes.js";

const app = express();


import rateLimit from "express-rate-limit";

const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
});

// Middlewares
app.use(limiter);
app.use(cors());
app.use(express.json());

// Request Timeout Middleware (15s)
app.use((req, res, next) => {
    res.setTimeout(15000, () => {
        console.error(`🕒 [Timeout] ${req.method} ${req.url} timed out`);
        if (!res.headersSent) {
            res.status(408).json({ error: "Request timeout" });
        }
    });
    next();
});

// Global request logger
app.use((req, res, next) => {
    console.log(`📥 [${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log(`   Headers:`, req.headers.authorization ? `Bearer ...${req.headers.authorization.slice(-20)}` : 'No auth');
    next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/pdf", pdfRoutes);
app.use("/api/print-jobs", printJobRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/shops", shopRoutes);
app.use("/api/print-drafts", printDraftRoutes);

import { getHealth } from "./controllers/healthController.js";

app.get("/api/health", getHealth);
app.get("/health", getHealth); // Keep alias if needed

export default app;
