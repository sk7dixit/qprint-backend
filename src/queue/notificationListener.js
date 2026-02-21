
import { QueueEvents } from "bullmq";
import { redisConnection } from "../config/redis.js";
import { emitToUser, emitToShop } from "../services/socketService.js";

const queueEvents = new QueueEvents("printQueue", {
    connection: redisConnection
});

export const initNotificationListener = () => {
    queueEvents.on("completed", async ({ jobId, returnvalue }) => {
        console.log(`✅ Job ${jobId} completed!`);

        if (returnvalue && returnvalue.success) {
            // Handle Finalize Print Job
            if (returnvalue.printJobId) { // Check if it's a finalize job result
                const { printJob } = returnvalue; // Changed to match worker return structure

                // Re-fetch printJob from DB if needed, but worker returns it? 
                // Worker returns { success: true, printJob: updatedJob } or { success: true, printJobId }
                // Let's check pdfWorker.js return value.
                // It returns { success: true, printJob: updatedJob }

                if (printJob) {
                    console.log(`📢 Emitting notification for Print Job ${printJob.id}`);
                    emitToUser(printJob.user_id, "printJobFinalized", printJob);
                    emitToShop(printJob.shop_id, "printJobCreated", printJob); // Notify shop now that file is ready
                }
            }
            // Handle Draft Processing (optional, if we want to notify completion)
            else if (returnvalue.newPath) {
                // It's a draft processing job
                // The frontend might be polling or we can emit "draftProcessed"
            }
        }
    });

    queueEvents.on("failed", ({ jobId, failedReason }) => {
        console.error(`❌ Job ${jobId} failed: ${failedReason}`);
        // Potentially emit failure notification
    });

    console.log("🔔 Notification Listener initialized for 'printQueue' queue.");
};
