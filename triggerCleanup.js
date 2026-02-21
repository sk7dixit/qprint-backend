import { cleanupQueue } from "./src/queue/cleanupQueue.js";

async function trigger() {
    console.log("Triggering cleanup job...");
    await cleanupQueue.add("cleanup-storage", {}, {
        removeOnComplete: true,
        removeOnFail: true
    });
    console.log("Job added to queue.");
    process.exit(0);
}

trigger();
