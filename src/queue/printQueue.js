import { Queue } from "bullmq";
import { redisConnection } from "../config/redis.js";

export const printQueue = new Queue("printQueue", {
    connection: redisConnection,
});
