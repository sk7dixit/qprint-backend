import pool from '../src/config/db.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const BUCKET_NAME = "uploads";

const cleanupFiles = async () => {
    try {
        console.log("🧹 Starting storage cleanup job...");

        // 1. Fetch Print Jobs to clean up
        const jobQuery = `
            SELECT id, final_pdf_url 
            FROM print_jobs 
            WHERE (status IN ('FAILED', 'CANCELLED') OR (status = 'PENDING_PAYMENT' AND created_at < NOW() - INTERVAL '1 hour'))
            AND file_deleted = FALSE
            AND final_pdf_url IS NOT NULL;
        `;
        const jobResult = await pool.query(jobQuery);
        console.log(`🔍 Found ${jobResult.rows.length} print jobs to clean up.`);
        for (const job of jobResult.rows) {
            await deleteFromSupabase(job.final_pdf_url, 'print_jobs', job.id);
        }

        // 2. Fetch Drafts to clean up
        const draftQuery = `
            SELECT id, converted_pdf_url 
            FROM print_job_drafts 
            WHERE (status = 'conversion_failed' OR created_at < NOW() - INTERVAL '24 hours')
            AND file_deleted = FALSE 
            AND converted_pdf_url IS NOT NULL;
        `;
        const draftResult = await pool.query(draftQuery);
        console.log(`🔍 Found ${draftResult.rows.length} drafts to clean up.`);
        for (const draft of draftResult.rows) {
            await deleteFromSupabase(draft.converted_pdf_url, 'print_job_drafts', draft.id);
        }

        // 3. Fetch Expired Metadata (Files table)
        const fileQuery = `
            SELECT id, file_url 
            FROM files 
            WHERE status = 'UPLOADED' 
            AND expires_at < NOW() 
            AND file_deleted = FALSE;
        `;
        const fileResult = await pool.query(fileQuery);
        console.log(`🔍 Found ${fileResult.rows.length} expired file uploads.`);
        for (const file of fileResult.rows) {
            await deleteFromSupabase(file.file_url, 'files', file.id, 'EXPIRED');
        }

        console.log("✅ Cleanup job completed successfully.");
        process.exit(0);
    } catch (error) {
        console.error("❌ Cleanup job failed:", error);
        process.exit(1);
    }
};

const deleteFromSupabase = async (urlOrPath, tableName, id, newStatus = null) => {
    try {
        // Extract path if it's a URL or just used as a path
        const path = urlOrPath.includes('storage/v1/object/public/')
            ? urlOrPath.split('storage/v1/object/public/uploads/')[1]
            : urlOrPath;

        console.log(`🗑️ Deleting ${path} from Supabase...`);
        const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([path]);

        if (error && error.status !== 404) {
            console.warn(`⚠️ Failed to delete ${path}:`, error.message);
            return; // Skip DB update if delete failed (unless not found)
        }

        const statusUpdate = newStatus ? `, status = '${newStatus}'` : '';
        await pool.query(
            `UPDATE ${tableName} SET file_deleted = TRUE ${statusUpdate}, updated_at = NOW() WHERE id = $1`,
            [id]
        );
        console.log(`✅ Marked ${tableName} ID ${id} as file_deleted.`);
    } catch (e) {
        console.error(`❌ Error during deletion for ${tableName} ID ${id}:`, e.message);
    }
};

cleanupFiles();
