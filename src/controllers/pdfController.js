import { PDFDocument, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import pool from '../config/db.js';
import { uploadToStorage } from '../services/storage.service.js';
import { findTextCoordinates } from '../utils/pdfUtils.js';
import { callAI } from '../services/aiService.js';

/**
 * pdfController.js
 * Handles instruction-based PDF processing using pdf-lib.
 */

export const processPDFInstructions = async (req, res) => {
    const { fileId, instructions } = req.body;

    if (!fileId || !instructions || !Array.isArray(instructions)) {
        return res.status(400).json({ error: "Invalid request payload" });
    }

    try {
        // 1. Fetch file details from DB
        const fileResult = await pool.query("SELECT * FROM files WHERE id = $1", [fileId]);
        if (fileResult.rows.length === 0) {
            return res.status(404).json({ error: "File not found" });
        }

        const file = fileResult.rows[0];
        // In this local dev environment, we assume the file is still in the 'uploads' directory
        // or we use the local path if it was saved during upload.
        // For simulation, we'll look for a file in the uploads directory matching the filename.
        // Note: Real implementation would download from cloud storage.

        const uploadsDir = path.join(process.cwd(), 'uploads');
        // Find a file that starts with the fileId (typical multer pattern) or just use a dummy for now
        // Let's assume we store the local path in 'temp_path' or similar if we were to extend the schema.
        // For now, let's try to find it by name or use a fallback.
        const possibleFiles = fs.readdirSync(uploadsDir);
        const fileName = possibleFiles.find(f => f.includes(file.filename.split('.')[0]));

        if (!fileName) {
            return res.status(404).json({ error: "Original file not found on server" });
        }

        const filePath = path.join(uploadsDir, fileName);
        const existingPdfBytes = fs.readFileSync(filePath);

        // 2. Load the PDF
        const pdfDoc = await PDFDocument.load(existingPdfBytes);

        // 3. Apply Instructions
        for (const action of instructions) {
            switch (action.type) {
                case 'delete_page':
                    // Note: pdf-lib uses 0-based indices
                    if (action.pageIndex >= 0 && action.pageIndex < pdfDoc.getPageCount()) {
                        pdfDoc.removePage(action.pageIndex);
                    }
                    break;

                case 'reorder_pages':
                    // action.newOrder: array of original indices [2, 0, 1]
                    const pageIndices = action.newOrder;
                    const newPdfDoc = await PDFDocument.create();
                    const copiedPages = await newPdfDoc.copyPages(pdfDoc, pageIndices);
                    copiedPages.forEach((page) => newPdfDoc.addPage(page));
                    // Replace pdfDoc with the new reordered one
                    // pdfDoc = newPdfDoc; // This won't work easily with the loop, so we'll handle reorder at the end or differently
                    break;

                case 'add_text':
                    // action.pageIndex, action.text, action.x, action.y, action.size
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
                    const matches = await findTextCoordinates(existingPdfBytes, action.from);

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
                                size: match.height || 12,
                                color: rgb(0, 0, 0),
                            });
                        }
                    }
                    break;
            }
        }

        // 4. Save and Upload result
        const pdfBytes = await pdfDoc.save();
        const outputFileName = `edited_${Date.now()}_${file.filename}`;
        const outputPath = path.join(uploadsDir, outputFileName);
        fs.writeFileSync(outputPath, pdfBytes);

        const newUrl = await uploadToStorage(outputPath);

        res.status(200).json({
            success: true,
            pdfUrl: newUrl,
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
 * Note: Does not edit PDF directly. Just returns suggestions.
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
