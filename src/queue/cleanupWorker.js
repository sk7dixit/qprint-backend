
import { Worker } from "bullmq";
import { redisConnection } from "../config/redis.js";
import pool from "../config/db.js";
import { supabase } from "../config/supabase.js";
import { cleanupQueue } from "./cleanupQueue.js";

console.log("🧹 Cleanup Worker Started");

const worker = new Worker(
    "cleanup-queue",
    async () => {

        console.log("🔍 Running cleanup task...");

        try {
            // 1️⃣ Find expired receipts
            const expiredReceipts = await pool.query(
                "SELECT * FROM payment_receipts WHERE expires_at < NOW()"
            );

            console.log(`Found ${expiredReceipts.rows.length} expired receipts.`);

            for (const receipt of expiredReceipts.rows) {

                // Delete related print job files
                const jobResult = await pool.query(
                    "SELECT final_pdf_url FROM print_jobs WHERE id = $1",
                    [receipt.print_job_id]
                );

                if (jobResult.rows.length > 0) {
                    const filePath = jobResult.rows[0].final_pdf_url;

                    if (filePath) {
                        const { error } = await supabase.storage
                            .from("uploads")
                            .remove([filePath]);

                        if (error) console.error(`Failed to delete Supabase file ${filePath}:`, error.message);
                        else console.log(`Deleted Supabase file: ${filePath}`);
                    }
                }

                // Delete print job (Cascade should handle receipt, but explicit delete is safe)
                await pool.query(
                    "DELETE FROM print_jobs WHERE id = $1",
                    [receipt.print_job_id]
                );

                // Delete receipt (if not already cascaded)
                await pool.query(
                    "DELETE FROM payment_receipts WHERE id = $1",
                    [receipt.id]
                );
            }

            console.log(`🧹 Cleanup completed. Removed ${expiredReceipts.rows.length} records.`);
            return { cleaned: expiredReceipts.rows.length };

        } catch (error) {
            console.error("❌ Cleanup Task Failed:", error);
            throw error;
        }
    },
    {
        connection: redisConnection,
        concurrency: 1,
    }
);

// Run immediately on start
cleanupQueue.add("run-cleanup", {});

// Run every 12 hours
setInterval(async () => {
    await cleanupQueue.add("run-cleanup", {});
}, 12 * 60 * 60 * 1000);

export default worker;
