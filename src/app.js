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

// Middlewares
app.use(cors());
app.use(express.json());

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

app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

export default app;
