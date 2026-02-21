
import { Queue } from "bullmq";
import { redisConnection } from "./connection.js";


const run = async () => {
    try {
        console.log("⏳ Connecting to Queue...");
        const queue = new Queue("pdf-processing", {
            connection: redisConnection,
        });

        console.log("⏳ Adding Job...");
        await queue.add("test-job", {
            message: "Queue is working",
            time: Date.now()
        });

        console.log("🟢 Test job added to queue");
        process.exit(0);
    } catch (error) {
        console.error("❌ Test Queue Failed:", error);
        process.exit(1);
    }
};

run();
