
import { Worker } from "bullmq";
import { redisConnection } from "./connection.js";
import pool from "../config/db.js";
import { downloadFile } from "../services/storage.service.js";
import { applyPDFActions } from "../services/pdf.service.js";
import { getPageCount } from "../services/conversion.service.js";
import { supabase } from "../config/supabase.js";

const worker = new Worker(
    "pdf-processing",
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

            try {
                // 1. Fetch Draft
                const draftRes = await pool.query("SELECT * FROM print_job_drafts WHERE id = $1", [draftId]);
                if (draftRes.rows.length === 0) throw new Error("Draft not found");
                const draft = draftRes.rows[0];

                // 2. Download Draft PDF
                const pdfBuffer = await downloadFile(draft.converted_pdf_url);

                // 3. Upload as Final Invoice/Job File
                const finalPdfName = `final_${printJobId}.pdf`;
                const finalPath = `final_invoices/${finalPdfName}`;

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('uploads')
                    .upload(finalPath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

                if (uploadError) throw uploadError;

                // 4. Create File Record
                const fileInsert = await pool.query(
                    "INSERT INTO files (user_id, filename, file_url, page_count, file_type) VALUES ($1, $2, $3, $4, 'pdf') RETURNING id",
                    [userId, finalPdfName, finalPath, draft.page_count]
                );
                const newFileId = fileInsert.rows[0].id;

                // 5. Update Print Job (PAID -> QUEUED)
                // Note: Payment validation happens in controller. Here we just confirm the file is ready.
                const updateQuery = `
                UPDATE print_jobs 
                SET status = 'QUEUED', final_pdf_url = $1, file_id = $2
                WHERE id = $3
                RETURNING *;
            `;
                const updatedJobResult = await pool.query(updateQuery, [finalPath, newFileId, printJobId]);

                // 6. Freeze Draft
                await pool.query("UPDATE print_job_drafts SET status = 'printed' WHERE id = $1", [draftId]);

                console.log(`Print Job ${printJobId} finalized.`);
                return { success: true, printJobId };

            } catch (error) {
                console.error(`Finalize Job ${job.id} Failed:`, error);
                // Optional: Update job status to error?
                throw error;
            }
        }
    },
    {
        connection: redisConnection,
        concurrency: 2,
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

console.log("PDF Worker started with concurrency 2...");
export default worker;
