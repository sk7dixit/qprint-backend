import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import fileRoutes from "./routes/fileRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

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
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);

app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

export default app;
