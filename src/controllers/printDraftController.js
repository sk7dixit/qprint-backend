import pool from "../config/db.js";
import { uploadToStorage } from "../services/storage.service.js";
import { processConversion, getPageCount } from "../services/conversion.service.js";
import { applyPDFActions } from "../services/pdf.service.js";
import { processAIHelper } from "../services/ai.service.js";

export const uploadDraft = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    const { source } = req.body;
    if (!source || !['shop', 'editor'].includes(source)) {
        return res.status(400).json({ error: "Invalid or missing source ('shop' or 'editor' required)" });
    }

    const { path: tempPath, originalname } = req.file;
    const ext = originalname.split(".").pop().toLowerCase();

    try {
        console.log(`[PrintDraftController] Received upload for ${originalname} (Source: ${source})`);

        // 1. Save original file (temp storage -> Supabase)
        // Note: For now we might just keep the temp path for conversion? 
        // Actually, Step 1 says "Upload API... Create Draft... Push to Conversion Queue".
        // The original file should probably be uploaded to storage too for safety/record.
        const originalFileKey = await uploadToStorage(tempPath);

        // 2. Create print_job_draft entry
        const query = `
            INSERT INTO print_job_drafts (user_id, original_file_name, original_file_type, original_file_url, source, status)
            VALUES ($1, $2, $3, $4, $5, 'uploaded')
            RETURNING id;
        `;
        const values = [req.user.id, originalname, ext, originalFileKey, source];
        const result = await pool.query(query, values);
        const draftId = result.rows[0].id;

        // 3. Trigger async conversion
        // We do NOT wait for this. We'll simulate the status update inside the conversion flow for Step 1 verification.
        convertAsync(draftId, tempPath, ext);

        res.status(201).json({
            draftId,
            status: "uploaded"
        });

    } catch (error) {
        console.error("Draft upload error:", error);
        res.status(500).json({ error: "Preparation failed", details: error.message });
    }
};

/**
 * Async helper to handle conversion without blocking the user
 */
async function convertAsync(draftId, tempPath, ext) {
    try {
        await pool.query("UPDATE print_job_drafts SET status = 'converting' WHERE id = $1", [draftId]);

        console.log(`[AsyncConversion] Starting conversion for draft ${draftId} (Type: ${ext})`);

        // Use the new master conversion function
        // It handles PDF validation, Office docs, and Images
        // For images, we might need to pass the path as an array if we support multiple images per draft later
        // For now, single file upload from the controller implies single path

        let pdfPath;
        try {
            pdfPath = await processConversion(tempPath, ext);
        } catch (convErr) {
            console.error(`[AsyncConversion] Conversion logic failed:`, convErr);
            throw convErr;
        }

        console.log(`[AsyncConversion] Conversion successful. Uploading PDF...`);
        const pdfKey = await uploadToStorage(pdfPath);
        const pageCount = await getPageCount(pdfPath);

        // Update DB with the KEY (not full URL, frontend will sign it) or Generate a Signed URL here?
        // Let's store the key for now. simpler.
        await pool.query(
            "UPDATE print_job_drafts SET status = 'ready_for_preview', converted_pdf_url = $1, page_count = $2 WHERE id = $3",
            [pdfKey, pageCount, draftId]
        );
        console.log(`[AsyncConversion] Draft ${draftId} is ready for preview. Pages: ${pageCount}`);

    } catch (error) {
        console.error(`[AsyncConversion] Failed for draft ${draftId}:`, error);
        await pool.query("UPDATE print_job_drafts SET status = 'conversion_failed' WHERE id = $1", [draftId]);
    }
}


/**
 * Get Draft Status
 */
export const getDraftStatus = async (req, res) => {
    const { draftId } = req.params;
    try {
        const result = await pool.query(
            "SELECT id, status, converted_pdf_url, page_count, original_file_name FROM print_job_drafts WHERE id = $1 AND user_id = $2",
            [draftId, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Draft not found" });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Get draft status error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

/**
 * Delete Draft (Replace File)
 */
export const deleteDraft = async (req, res) => {
    const { draftId } = req.params;
    try {
        const result = await pool.query(
            "DELETE FROM print_job_drafts WHERE id = $1 AND user_id = $2 RETURNING *",
            [draftId, req.user.id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Draft not found or unauthorized" });
        }
        res.json({ message: "Draft deleted successfully" });
    } catch (error) {
        console.error("Delete draft error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

/**
 * Update Draft Status (Continue to Shop)
 */
export const updateDraftStatus = async (req, res) => {
    const { draftId } = req.params;
    const { status } = req.body;

    // Strict allowed transitions for this endpoint
    if (status !== 'ready_for_checkout') {
        return res.status(400).json({ error: "Invalid status update" });
    }

    try {
        const result = await pool.query(
            "UPDATE print_job_drafts SET status = $1 WHERE id = $2 AND user_id = $3 AND status = 'ready_for_preview' RETURNING *",
            [status, draftId, req.user.id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Draft not found, unauthorized, or not in ready state" });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Update draft status error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

/**
 * Process Draft Edits (Rotate, Delete, JSON Actions)
 */
export const processDraftEdits = async (req, res) => {
    const { draftId } = req.params;
    const { instructions } = req.body;

    if (!instructions || !Array.isArray(instructions)) {
        return res.status(400).json({ error: "Invalid instructions format" });
    }

    try {
        const draftRes = await pool.query(
            "SELECT converted_pdf_url FROM print_job_drafts WHERE id = $1 AND user_id = $2",
            [draftId, req.user.id]
        );

        if (draftRes.rows.length === 0) {
            return res.status(404).json({ error: "Draft not found" });
        }

        const currentPdfPath = draftRes.rows[0].converted_pdf_url;
        const newPdfKey = await applyPDFActions(currentPdfPath, instructions);

        await pool.query(
            "UPDATE print_job_drafts SET converted_pdf_url = $1, page_count = $2 WHERE id = $3",
            [newPdfKey.key, newPdfKey.pageCount, draftId]
        );

        res.json({
            success: true,
            pdfUrl: newPdfKey.key
        });

    } catch (error) {
        console.error("Process Edits Error:", error);
        res.status(500).json({ error: "Failed to process edits", details: error.message });
    }
};

/**
 * Process AI Request
 */
export const processAIRequest = async (req, res) => {
    const { task, text } = req.body;

    try {
        const result = await processAIHelper(task, text);
        res.json({ success: true, result });
    } catch (error) {
        console.error("AI Request Error:", error);
        res.status(500).json({ error: "AI processing failed" });
    }
};
