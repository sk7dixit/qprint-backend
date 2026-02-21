
import { Queue } from "bullmq";
import { redisConnection } from "../config/redis.js";

export const cleanupQueue = new Queue("cleanup-queue", {
    connection: redisConnection,
});
