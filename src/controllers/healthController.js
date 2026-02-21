
import pool from "../config/db.js";
import { redisConnection } from "../queue/connection.js";
import { pdfQueue } from "../queue/pdfQueue.js";

export const getHealth = async (req, res) => {
    const health = {
        status: "OK",
        uptime: process.uptime(),
        timestamp: new Date(),
        services: {}
    };

    try {
        // DB check
        await pool.query("SELECT 1");
        health.services.database = "connected";
    } catch (err) {
        health.status = "DEGRADED";
        health.services.database = "disconnected";
        console.error("Health Check - DB Failed:", err);
    }

    try {
        // Redis check
        await redisConnection.ping();
        health.services.redis = "connected";
    } catch (err) {
        health.status = "DEGRADED";
        health.services.redis = "disconnected";
        console.error("Health Check - Redis Failed:", err);
    }

    try {
        // Queue metrics
        const waiting = await pdfQueue.getWaitingCount();
        const active = await pdfQueue.getActiveCount();
        const failed = await pdfQueue.getFailedCount();

        health.services.queue = {
            waiting,
            active,
            failed
        };
    } catch (err) {
        health.services.queue = "error fetching metrics";
        console.error("Health Check - Queue Metrics Failed:", err);
    }

    // Memory usage
    health.memory = process.memoryUsage();

    const statusCode = health.status === "OK" ? 200 : 503;
    res.status(statusCode).json(health);
};
