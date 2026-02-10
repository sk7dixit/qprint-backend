
import { PDFDocument, rgb } from 'pdf-lib';
import pool from '../config/db.js';
import { uploadToStorage, downloadFile } from '../services/storage.service.js';
import { findTextCoordinates } from '../utils/pdfUtils.js';
import { callAI } from '../services/aiService.js';
import fs from 'fs';
import path from 'path';

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

        // 3. Load the PDF
        const pdfDoc = await PDFDocument.load(pdfBytes);

        // 4. Apply Instructions
        for (const action of instructions) {
            switch (action.type) {
                case 'delete_page':
                    // Note: pdf-lib uses 0-based indices
                    // We need to be careful with indices shifting if we delete multiple.
                    // Frontend usually sends them in reverse order, but let's assume valid indices.
                    if (action.pageIndex >= 0 && action.pageIndex < pdfDoc.getPageCount()) {
                        // Removing a page shifts indices. 
                        // If we are processing a batch, checking index validity is tricky.
                        // Simplification: Try/Catch per action or assume frontend sends sound instructions.
                        try {
                            pdfDoc.removePage(action.pageIndex);
                        } catch (e) { console.warn("Page removal failed", e); }
                    }
                    break;

                case 'reorder_pages':
                    // Not fully implemented in previous version, keeping placeholder or skipping
                    break;

                case 'add_text':
                    const pages = pdfDoc.getPages();
                    const page = pages[action.pageIndex];
                    if (page) {
                        page.drawText(action.text, {
                            x: action.x,
                            y: action.y,
                            size: action.size || 12,
                            color: rgb(0, 0, 0),
                        });
                    }
                    break;

                case 'rotate_page':
                    const targetPage = pdfDoc.getPages()[action.pageIndex];
                    if (targetPage) {
                        const currentRotation = targetPage.getRotation().angle;
                        targetPage.setRotation({ angle: (currentRotation + (action.degrees || 90)) % 360 });
                    }
                    break;

                case 'replace_text':
                    console.log(`[PDFController] Running Global Replace: "${action.from}" -> "${action.to}"`);
                    // Note: findTextCoordinates requires pdf-parse logic usually on the raw buffer
                    // We pass the raw buffer 'pdfBytes' again
                    const matches = await findTextCoordinates(pdfBytes, action.from);

                    for (const match of matches) {
                        const page = pdfDoc.getPages()[match.pageIndex];
                        if (page) {
                            // 1. White-out the original text
                            page.drawRectangle({
                                x: match.x,
                                y: match.y,
                                width: match.width,
                                height: match.height || 12,
                                color: rgb(1, 1, 1), // White
                            });

                            // 2. Overlay new text
                            page.drawText(action.to, {
                                x: match.x,
                                y: match.y,
                                size: 10, // heuristic font size since we don't know original
                                color: rgb(0, 0, 0),
                            });
                        }
                    }
                    break;
            }
        }

        // 5. Save and Upload result
        const editedPdfBytes = await pdfDoc.save();

        // Save to temporary local file to upload (uploadToStorage expects a file path)
        // OR update uploadToStorage to accept Buffer?
        // Current uploadToStorage takes a filePath.
        const tempName = `edited_${Date.now()}_${draftId}.pdf`;
        const tempPath = path.join(process.cwd(), 'uploads', tempName); // Ensure uploads dir exists

        if (!fs.existsSync(path.dirname(tempPath))) {
            fs.mkdirSync(path.dirname(tempPath), { recursive: true });
        }

        fs.writeFileSync(tempPath, editedPdfBytes);

        // Upload to Supabase
        const newKey = await uploadToStorage(tempPath);

        // Cleanup temp file
        fs.unlinkSync(tempPath);

        // 6. Update Draft Record
        await pool.query(
            "UPDATE print_job_drafts SET converted_pdf_url = $1, page_count = $2 WHERE id = $3",
            [newKey, pdfDoc.getPageCount(), draftId]
        );

        res.status(200).json({
            success: true,
            pdfUrl: newKey, // Frontend might need to sign this or just know it's done
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
