import { db } from '../config/db.js';
import { applyPDFActions } from '../services/pdf.service.js';
import { processSpellFix, processFormatClean } from '../services/ai.service.js';

import { getPageCount, convertToPDF, processConversion } from '../services/conversion.service.js';
import { printQueue } from "../queue/printQueue.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

/**
 * Upload Initial File and Create Draft
 * Route: POST /api/print-drafts/upload
 */
/**
 * Step 1: Generate Signed Upload URL for Draft
 * Route: POST /api/print-drafts/generate-upload-url
 */
import { supabase } from '../config/supabase.js';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { PDFParse } from 'pdf-parse';

export const uploadDraft = async (req, res) => {
    let tempInputPath = null;
    let tempOutputPath = null;

    try {
        console.log("📥 Upload request received");

        const file = req.file;
        if (!file) {
            console.warn("⚠️ No file in request");
            return res.status(400).json({ error: "No file uploaded" });
        }

        if (!req.user || !req.user.id) {
            console.error("❌ Authentication missing req.user.id");
            return res.status(401).json({ error: "Unauthorized: User session missing" });
        }

        const userId = req.user.id;
        const timestamp = Date.now();
        const originalName = file.originalname;
        const ext = path.extname(originalName).toLowerCase();

        console.log(`📂 Processing Upload: ${originalName} for User: ${userId}`);

        let finalBuffer = file.buffer;
        let finalMimeType = file.mimetype;
        let finalFileName = originalName;

        // 1. Convert DOCX/PPTX/Images if needed
        if (ext !== '.pdf') {
            console.log(`🔄 Conversion required for type: ${ext}`);
            // Write buffer to temp disk for soffice/pdf-lib
            const tempDir = await fs.realpath(os.tmpdir());
            tempInputPath = path.join(tempDir, `${timestamp}-${originalName}`);
            await fs.writeFile(tempInputPath, file.buffer);

            // Execute Conversion
            try {
                tempOutputPath = await processConversion(tempInputPath, ext);
                finalBuffer = await fs.readFile(tempOutputPath);
                finalMimeType = 'application/pdf';
                // LibreOffice replaces extension with .pdf
                finalFileName = `${path.basename(originalName, ext)}.pdf`;
            } catch (convErr) {
                console.error("❌ Conversion Failed:", convErr);
                return res.status(422).json({ error: convErr.message || "File format conversion failed or is unsupported." });
            }
        }

        const supabasePath = `user-uploads/${userId}/drafts/${timestamp}-${finalFileName}`;

        // 2. Upload to Supabase
        const { error: uploadError } = await supabase.storage
            .from('uploads')
            .upload(supabasePath, finalBuffer, {
                contentType: finalMimeType,
                upsert: false
            });

        if (uploadError) {
            console.error("❌ Supabase Upload Error:", uploadError);
            throw uploadError;
        }

        let extractedText = "Parsed by PDF.js live";

        // 3. Create Draft Entry
        const query = `
            INSERT INTO print_job_drafts 
            (user_id, original_file_name, original_file_type, original_file_url, converted_pdf_url, page_count, source, status, extracted_text)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'uploaded', $8)
            RETURNING id;
        `;

        const result = await db.query(query, [
            userId,
            originalName, // Original name
            file.mimetype, // Original mime
            supabasePath, // Keeping it simple: both point to the final PDF for now
            supabasePath,
            0, // Page count pending processing
            'editor',
            extractedText
        ]);

        console.log(`✅ Draft Created: ${result.rows[0].id}`);

        res.status(201).json({
            success: true,
            draftId: result.rows[0].id
        });

    } catch (error) {
        console.error("❌ Upload Route Crash:", error);
        res.status(500).json({ error: "Upload failed: " + error.message });
    } finally {
        // Cleanup temp files
        const cleanup = async (p) => {
            if (p) {
                try { await fs.unlink(p); } catch (e) { /* ignore */ }
            }
        };
        await cleanup(tempInputPath);
        if (tempOutputPath && tempOutputPath !== tempInputPath) {
            await cleanup(tempOutputPath);
        }
    }
};

export const getDraft = async (req, res) => {
    const { draftId } = req.params;
    const userId = req.user.id;

    try {
        const result = await db.query(
            "SELECT * FROM print_job_drafts WHERE id = $1 AND user_id::text = $2::text",
            [draftId, String(userId)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Draft not found" });
        }

        const draft = result.rows[0];

        // Generate Signed URL
        const { data, error } = await supabase.storage
            .from('uploads')
            .createSignedUrl(draft.converted_pdf_url, 3600);

        if (error) throw error;

        res.json({
            id: draft.id,
            signedUrl: data.signedUrl,
            pageCount: draft.page_count || 1, // Fallback
            status: draft.status,
            fileName: draft.original_file_name,
            extractedText: draft.extracted_text || ""
        });

    } catch (error) {
        console.error("Get Draft Error:", error);
        res.status(500).json({ error: "Failed to fetch draft" });
    }
};

// Kept for backward compatibility or polling if needed
export const getDraftStatus = async (req, res) => {
    const { draftId } = req.params;
    const userId = req.user.id;

    try {
        const result = await db.query(
            "SELECT status, page_count FROM print_job_drafts WHERE id = $1 AND user_id::text = $2::text",
            [draftId, String(userId)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Draft not found" });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Get Draft Status Error:", error);
        res.status(500).json({ error: "Failed to fetch draft status" });
    }
};

/**
 * Delete Draft
 * Route: DELETE /api/print-drafts/:draftId
 */
export const deleteDraft = async (req, res) => {
    const { draftId } = req.params;
    const userId = req.user.id;

    try {
        const result = await db.query(
            "DELETE FROM print_job_drafts WHERE id = $1 AND user_id::text = $2::text RETURNING *",
            [draftId, String(userId)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Draft not found or unauthorized" });
        }

        res.json({ success: true, message: "Draft deleted successfully" });
    } catch (error) {
        console.error("Delete Draft Error:", error);
        res.status(500).json({ error: "Failed to delete draft" });
    }
};

/**
 * Update Draft Status (e.g., to 'ready_for_print')
 * Route: PATCH /api/print-drafts/:draftId/status
 */
export const updateDraftStatus = async (req, res) => {
    const { draftId } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    if (!status) {
        return res.status(400).json({ error: "Status is required" });
    }

    try {
        const result = await db.query(
            "UPDATE print_job_drafts SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id::text = $3::text RETURNING *",
            [status, draftId, String(userId)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Draft not found or unauthorized" });
        }

        res.json({ success: true, draft: result.rows[0] });
    } catch (error) {
        console.error("Update Draft Status Error:", error);
        res.status(500).json({ error: "Failed to update draft status" });
    }
};

/**
 * Process Draft Edits (Regenerate PDF from text)
 * Route: POST /api/print-drafts/:draftId/process
 */
export const processDraftEdits = async (req, res) => {
    const { draftId } = req.params;
    const { updatedTextItems } = req.body; // Array of { text, x, y, size }
    const userId = req.user.id;

    if (!updatedTextItems || !Array.isArray(updatedTextItems)) {
        return res.status(400).json({ error: "Missing or invalid updatedTextItems payload" });
    }

    try {
        // 0. Set status to Processing
        await db.query(
            "UPDATE print_job_drafts SET status = 'processing' WHERE id = $1 AND user_id::text = $2::text",
            [draftId, String(userId)]
        );

        // 1. Get original file URL
        const draftRes = await db.query(
            "SELECT original_file_url FROM print_job_drafts WHERE id = $1",
            [draftId]
        );
        const originalPath = draftRes.rows[0].original_file_url;

        // 2. Download original PDF from Supabase
        const { data: fileData, error: downloadError } = await supabase.storage
            .from('uploads')
            .download(originalPath);

        if (downloadError) throw downloadError;

        const arrayBuffer = await fileData.arrayBuffer();

        // 3. Load into pdf-lib
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
        const fontBoldItalic = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

        const pages = pdfDoc.getPages();

        for (const item of updatedTextItems) {
            const pageIndex = (item.pageNum || 1) - 1;
            if (pageIndex < 0 || pageIndex >= pages.length) continue;
            const page = pages[pageIndex];

            // Frontend now sends exact PDF-native coordinates (unscaled)
            const pdfX = item.x;
            const pdfY = item.y;
            const pdfFontSize = item.size || 12;

            // Determine active font based on style flags
            const isBold = item.fontWeight === 'bold';
            const isItalic = item.fontStyle === 'italic';
            let activeFont = font;
            if (isBold && !isItalic) activeFont = fontBold;
            if (!isBold && isItalic) activeFont = fontItalic;
            if (isBold && isItalic) activeFont = fontBoldItalic;

            // Parse hex color to RGB (0-1 values)
            let r = 0.2, g = 0.2, b = 0.2; // default text-slate-700 approx
            if (item.color && item.color.startsWith('#') && item.color.length === 7) {
                const hex = item.color.replace('#', '');
                r = parseInt(hex.substring(0, 2), 16) / 255;
                g = parseInt(hex.substring(2, 4), 16) / 255;
                b = parseInt(hex.substring(4, 6), 16) / 255;
            }

            // Approximate text physical width
            const approxWidth = item.text.length * pdfFontSize * 0.55;

            // Mask original word if it existed previously
            if (!item.isNew) {
                page.drawRectangle({
                    x: pdfX,
                    // item.y is usually baseline. Pull down slightly to cover descenders (e.g., g, y)
                    y: pdfY - (pdfFontSize * 0.2),
                    width: approxWidth,
                    height: pdfFontSize * 1.2,
                    color: { type: 'RGB', red: 1, green: 1, blue: 1 },
                });
            }

            // Draw new styled text
            page.drawText(item.text, {
                x: pdfX,
                y: pdfY,
                size: pdfFontSize,
                font: activeFont,
                color: { type: 'RGB', red: r, green: g, blue: b }
            });

            // Handle Underlines via line drawing
            if (item.textDecoration === 'underline') {
                page.drawLine({
                    start: { x: pdfX, y: pdfY - (pdfFontSize * 0.1) },
                    end: { x: pdfX + approxWidth, y: pdfY - (pdfFontSize * 0.1) },
                    thickness: pdfFontSize * 0.08,
                    color: { type: 'RGB', red: r, green: g, blue: b }
                });
            }
        }

        const pdfBytes = await pdfDoc.save();
        const buffer = Buffer.from(pdfBytes);

        // Upload new generated file
        const newPath = `user-uploads/${userId}/drafts/edited-${draftId}-${Date.now()}.pdf`;

        const { error: uploadError } = await supabase.storage
            .from('uploads')
            .upload(newPath, buffer, {
                contentType: 'application/pdf',
                upsert: true
            });

        if (uploadError) throw uploadError;

        // Update draft with new path
        await db.query(
            "UPDATE print_job_drafts SET converted_pdf_url = $1, status = 'ready_for_preview' WHERE id = $2",
            [newPath, draftId]
        );

        // Fetch signed url for response
        const { data: signedData } = await supabase.storage
            .from('uploads')
            .createSignedUrl(newPath, 3600);

        res.json({
            success: true,
            message: "PDF generated successfully",
            newSignedUrl: signedData.signedUrl
        });

    } catch (error) {
        console.error("Generate PDF Error:", error);
        // Revert status if fails
        await db.query(
            "UPDATE print_job_drafts SET status = 'ready_for_preview' WHERE id = $1",
            [draftId]
        );
        res.status(500).json({ error: "Failed to generate new PDF" });
    }
};

/**
 * AI Spell Fix (Preserving Structure)
 * Route: POST /api/print-drafts/:draftId/spell-fix
 */
export const spellFix = async (req, res) => {
    const { pages } = req.body;

    if (!pages || !Array.isArray(pages)) {
        return res.status(400).json({ error: "Missing structured pages array" });
    }

    try {
        const updatedPages = await processSpellFix(pages);
        res.json({ pages: updatedPages });
    } catch (error) {
        console.error("AI Spell Fix Error:", error);
        res.status(500).json({ error: "Spell fix processing failed: " + error.message, pages }); // Always return original pages as fallback
    }
};

/**
 * AI Format Clean (Preserving Structure)
 * Route: POST /api/print-drafts/:draftId/format-clean
 */
export const formatClean = async (req, res) => {
    const { pages } = req.body;

    if (!pages || !Array.isArray(pages)) {
        return res.status(400).json({ error: "Missing structured pages array" });
    }

    try {
        const updatedPages = await processFormatClean(pages);
        res.json({ pages: updatedPages });
    } catch (error) {
        console.error("AI Format Clean Error:", error);
        res.status(500).json({ error: "Format clean processing failed: " + error.message, pages }); // Always return original pages as fallback
    }
};
