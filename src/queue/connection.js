
import IORedis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
    console.error("Redis Connection: Missing REDIS_URL in .env");
}

export const redisConnection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    // tls: {} // Required for Upstash
});
