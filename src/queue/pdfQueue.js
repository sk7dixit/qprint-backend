
import { Queue } from "bullmq";
import { redisConnection } from "./connection.js";

export const pdfQueue = new Queue("pdf-processing", {
    connection: redisConnection,
});
