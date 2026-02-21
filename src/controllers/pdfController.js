
import { PDFDocument, rgb } from 'pdf-lib';
import pool from '../config/db.js';
import { downloadFile } from '../services/storage.service.js';
import { findTextCoordinates } from '../utils/pdfUtils.js';
import { callAI } from '../services/aiService.js';


/**
 * pdfController.js
 * Handles instruction-based PDF processing using pdf-lib.
 * Now integrated with Step 3 Draft System and Supabase.
 */

export const processPDFInstructions = async (req, res) => {
    const { fileId, instructions } = req.body; // fileId is draftId here
    const draftId = fileId;

    if (!draftId || !instructions || !Array.isArray(instructions)) {
        return res.status(400).json({ error: "Invalid request payload" });
    }

    try {
        // 1. Fetch Draft & Enforce Step 3 Constraints
        const draftQuery = `
            SELECT * FROM print_job_drafts 
            WHERE id = $1 AND user_id = $2
        `;
        const draftResult = await pool.query(draftQuery, [draftId, req.user.id]);

        if (draftResult.rows.length === 0) {
            return res.status(404).json({ error: "Draft not found or unauthorized" });
        }

        const draft = draftResult.rows[0];

        // HARD CONSTRAINT: Editor CANNOT load/edit draft unless ready_for_preview
        if (draft.status !== 'ready_for_preview') {
            return res.status(403).json({ error: "Draft is not ready for editing. Status must be 'ready_for_preview'." });
        }

        if (!draft.converted_pdf_url) {
            return res.status(400).json({ error: "No PDF file associated with this draft." });
        }

        // 2. Download the PDF from Supabase (it's a path key now)
        let pdfBytes;
        try {
            pdfBytes = await downloadFile(draft.converted_pdf_url);
        } catch (downloadError) {
            console.error("Failed to download PDF:", downloadError);
            return res.status(500).json({ error: "Failed to retrieve source PDF." });
        }

        // 3. Process the PDF in-memory
        const { applyPDFActions } = await import('../services/pdf.service.js');
        const editedPdfBuffer = await applyPDFActions(pdfBytes, instructions);

        // 4. Upload result
        // 4. Upload result
        const { supabase } = await import('../config/supabase.js');
        const timestamp = Date.now();
        const newPath = `edits/${req.user.id}/${timestamp}-edited.pdf`;

        const { error: uploadError } = await supabase.storage
            .from('uploads')
            .upload(newPath, editedPdfBuffer, {
                contentType: 'application/pdf',
                upsert: false
            });

        if (uploadError) throw uploadError;
        const newKey = newPath;

        // 5. Update Draft Record
        const { getPageCount } = await import('../services/conversion.service.js');
        const pageCount = await getPageCount(editedPdfBuffer);

        await pool.query(
            "UPDATE print_job_drafts SET converted_pdf_url = $1, page_count = $2 WHERE id = $3",
            [newKey, pageCount, draftId]
        );

        res.status(200).json({
            success: true,
            pdfUrl: newKey,
            message: "Instructions applied successfully"
        });
    } catch (error) {
        console.error("PDF Processing Error:", error);
        res.status(500).json({ error: "Failed to process PDF instructions" });
    }
};

/**
 * handleAIRequest
 * Bridge for frontend to Cloudflare AI. 
 */
export const handleAIRequest = async (req, res) => {
    const { task, text } = req.body;

    if (!task || !text) {
        return res.status(400).json({ error: "Task and text are required." });
    }

    try {
        const result = await callAI(task, text);
        res.status(200).json({ success: true, result });
    } catch (error) {
        console.error("AI Bridge Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};
