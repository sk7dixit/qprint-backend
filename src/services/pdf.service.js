import { PDFDocument, degrees } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { uploadToStorage, downloadFile } from './storage.service.js';
import { getPageCount } from './conversion.service.js';

/**
 * Apply PDF Actions (Rotate, Delete, etc.)
 * @param {string} currentPdfKey - Storage key/path
 * @param {Array} actions - JSON actions from Editor
 * @returns {Object} { key, pageCount }
 */
export const applyPDFActions = async (currentPdfKey, actions) => {
    console.log(`[PDFService] Applying ${actions.length} actions to ${currentPdfKey}`);

    // 1. Download current file
    const pdfBuffer = await downloadFile(currentPdfKey);

    // 2. Load PDF
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    // 3. Process Actions
    // Important: Delete actions should be processed in reverse order or tracked carefully
    // because deleting a page changes following indices.

    // Sort actions: process page modifications first, then deletions in reverse order?
    // Actually, it's safer to handle them sequentially if the indices are relative to the *initial* state.
    // The Editor usually sends indices based on the current UI state.

    // Let's implement basic rotation and deletion.
    for (const action of actions) {
        if (action.type === 'rotate_page') {
            const page = pdfDoc.getPage(action.pageIndex);
            page.setRotation(degrees(page.getRotation().angle + (action.degrees || 90)));
            console.log(`[PDFService] Rotated page ${action.pageIndex}`);
        }
    }

    // Handle deletions separately in reverse order
    const deleteActions = actions.filter(a => a.type === 'delete_page')
        .sort((a, b) => b.pageIndex - a.pageIndex);

    for (const action of deleteActions) {
        pdfDoc.removePage(action.pageIndex);
        console.log(`[PDFService] Deleted page ${action.pageIndex}`);
    }

    // 4. Save and Upload
    const modifiedPdfBytes = await pdfDoc.save();
    const tempFileName = `edited-${Date.now()}-${path.basename(currentPdfKey)}`;
    const tempPath = path.join('uploads', tempFileName);

    await fs.writeFile(tempPath, modifiedPdfBytes);

    const newKey = await uploadToStorage(tempPath);
    const pageCount = await getPageCount(tempPath);

    // Cleanup local temp file
    await fs.unlink(tempPath).catch(console.error);

    return { key: newKey, pageCount };
};
