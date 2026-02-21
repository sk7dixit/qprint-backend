import { Worker } from "bullmq";
import { redisConnection } from "../config/redis.js";
import pool from "../config/db.js";
import { downloadFile } from "../services/storage.service.js";
import { applyPDFActions } from "../services/pdf.service.js";
import { getPageCount } from "../services/conversion.service.js";
import { supabase } from "../config/supabase.js";
import { isValidTransition, validPaymentTransitions, validPrintTransitions } from "../utils/stateMachine.js";

const worker = new Worker(
    "printQueue",
    async (job) => {
        // Determine Job Type
        // Legacy support: if job.name is undefined or default, treat as process-draft
        const jobType = job.name === "finalize-print-job" ? "finalize" : "process";

        if (jobType === "process") {
            const { draftId, userId, actions } = job.data;
            console.log(`Processing Draft ${draftId} (Job ${job.id})...`);

            try {
                // 1. Fetch draft
                const draftRes = await pool.query(
                    "SELECT * FROM print_job_drafts WHERE id = $1",
                    [draftId]
                );

                if (draftRes.rows.length === 0) throw new Error("Draft not found");
                const draft = draftRes.rows[0];

                // 2. Download file
                const pdfBuffer = await downloadFile(draft.converted_pdf_url);

                // 3. Apply actions
                const editedPdfBuffer = await applyPDFActions(pdfBuffer, actions);

                // 4. Upload new file
                const timestamp = Date.now();
                const newPath = `user-uploads/${userId}/drafts/${timestamp}-processed.pdf`;

                const { error } = await supabase.storage
                    .from("uploads")
                    .upload(newPath, editedPdfBuffer, { contentType: "application/pdf", upsert: false });

                if (error) throw error;

                const pageCount = await getPageCount(editedPdfBuffer);

                // 5. Update DB - SUCCESS (Ready for Preview)
                await pool.query(
                    "UPDATE print_job_drafts SET converted_pdf_url = $1, page_count = $2, status = 'ready_for_preview', updated_at = NOW() WHERE id = $3",
                    [newPath, pageCount, draftId]
                );

                console.log(`Job ${job.id} completed. New path: ${newPath}`);
                return { success: true, newPath, pageCount };

            } catch (error) {
                console.error(`Job ${job.id} failed:`, error);
                await pool.query("UPDATE print_job_drafts SET status = 'failed', updated_at = NOW() WHERE id = $1", [draftId]);
                throw error;
            }
        }

        else if (jobType === "finalize") {
            const { printJobId, userId, draftId } = job.data;
            console.log(`Finalizing Print Job ${printJobId} (Job ${job.id})...`);

            const client = await pool.connect(); // Get client for transaction

            try {
                await client.query("BEGIN"); // Start Transaction

                // 1. Fetch Job & Check Transitions
                const jobRes = await client.query("SELECT * FROM print_jobs WHERE id = $1", [printJobId]);
                if (jobRes.rows.length === 0) throw new Error("Print job not found");
                const printJob = jobRes.rows[0];

                if (!isValidTransition(printJob.payment_status, "PAID", validPaymentTransitions)) {
                    throw new Error(`Invalid payment transition from ${printJob.payment_status} to PAID`);
                }

                // Allow transition from PROCESSING_PAYMENT to QUEUED
                if (!isValidTransition(printJob.status, "QUEUED", validPrintTransitions)) {
                    throw new Error(`Invalid status transition from ${printJob.status} to QUEUED`);
                }

                // 2. Fetch Draft
                const draftRes = await client.query("SELECT * FROM print_job_drafts WHERE id = $1", [draftId]);
                if (draftRes.rows.length === 0) throw new Error("Draft not found");
                const draft = draftRes.rows[0];

                // 3. Download Draft PDF (Outside transaction is fine, but failing here aborts)
                const pdfBuffer = await downloadFile(draft.converted_pdf_url);

                // 4. Upload as Final Invoice/Job File
                const finalPdfName = `final_${printJobId}.pdf`;
                const finalPath = `final_invoices/${finalPdfName}`;

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('uploads')
                    .upload(finalPath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

                if (uploadError) throw uploadError;

                // 5. Create File Record
                const fileInsert = await client.query(
                    "INSERT INTO files (user_id, filename, file_url, page_count, file_type) VALUES ($1, $2, $3, $4, 'pdf') RETURNING id",
                    [userId, finalPdfName, finalPath, draft.page_count]
                );
                const newFileId = fileInsert.rows[0].id;

                // 6. Update Print Job (PAID -> QUEUED)
                const updateQuery = `
                UPDATE print_jobs 
                SET payment_status = 'PAID', status = 'QUEUED', final_pdf_url = $1, file_id = $2
                WHERE id = $3
                RETURNING *;
            `;
                const updatedJobResult = await client.query(updateQuery, [finalPath, newFileId, printJobId]);
                const updatedJob = updatedJobResult.rows[0];

                // 7. Create Payment Receipt (Meta-data only, no file)
                const expiresAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days expiry
                await client.query(
                    `INSERT INTO payment_receipts 
                    (print_job_id, user_id, shop_id, amount, payment_id, expires_at)
                    VALUES ($1, $2, $3, $4, $5, $6)`,
                    [
                        printJobId,
                        userId,
                        updatedJob.shop_id,
                        updatedJob.amount,
                        "PAYMENT_CONFIRMED", // TODO: Replace with actual gateway payment ID if available in job.data
                        expiresAt
                    ]
                );

                // 8. Freeze Draft
                await client.query("UPDATE print_job_drafts SET status = 'printed' WHERE id = $1", [draftId]);

                await client.query("COMMIT"); // Commit Transaction

                console.log(`Print Job ${printJobId} finalized.`);
                return { success: true, printJob: updatedJob };

            } catch (error) {
                await client.query("ROLLBACK"); // Rollback on error
                console.error(`Finalize Job ${job.id} Failed:`, error);
                throw error;
            } finally {
                client.release(); // Release client
            }
        }
    },
    {
        connection: redisConnection,
        concurrency: 3, // IMPORTANT: do not increase on free tier
        lockDuration: 60000,
    }
);

// Global Error Listeners
worker.on("failed", (job, err) => {
    console.error(`Job ${job.id} failed globally:`, err.message);
});

worker.on("completed", (job) => {
    console.log(`Job ${job.id} completed successfully`);
});

// Graceful Shutdown
process.on("SIGTERM", async () => {
    console.log("SIGTERM received. Closing worker...");
    await worker.close();
    process.exit(0);
});

console.log("PDF Worker started with concurrency 3...");

// Worker Heartbeat
setInterval(() => {
    console.log("💓 Worker heartbeat:", new Date().toISOString());
}, 30000);

export default worker;
