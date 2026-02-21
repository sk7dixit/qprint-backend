import { PDFDocument, degrees, rgb } from 'pdf-lib';
import { findTextCoordinates } from '../utils/pdfUtils.js';

/**
 * Apply a series of actions to a PDF Buffer.
 * @param {Buffer} pdfBuffer - The source PDF buffer.
 * @param {Array} actions - List of actions to perform.
 * @returns {Promise<Buffer>} - The modified PDF buffer.
 */
export async function applyPDFActions(pdfBuffer, actions) {
    if (!actions || actions.length === 0) return pdfBuffer;

    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();

    // Track which pages to keep (0-indexed)
    let pageIndicesToKeep = pages.map((_, i) => i);
    let hasStructuralChanges = false;

    for (const action of actions) {
        switch (action.type) {
            case 'rotate_page':
                const rotIndex = action.pageIndex;
                if (rotIndex >= 0 && rotIndex < pages.length) {
                    const page = pages[rotIndex];
                    const currentRotation = page.getRotation().angle;
                    page.setRotation(degrees(currentRotation + (action.degrees || 90)));
                }
                break;

            case 'delete_page':
                hasStructuralChanges = true;
                pageIndicesToKeep = pageIndicesToKeep.filter(idx => idx !== action.pageIndex);
                break;

            case 'reorder_pages':
                hasStructuralChanges = true;
                if (action.newOrder && Array.isArray(action.newOrder)) {
                    pageIndicesToKeep = action.newOrder;
                }
                break;

            case 'add_text':
                const textPage = pdfDoc.getPages()[action.pageIndex];
                if (textPage) {
                    textPage.drawText(action.text, {
                        x: action.x,
                        y: action.y,
                        size: action.size || 12,
                        color: rgb(0, 0, 0),
                    });
                }
                break;

            case 'replace_text':
                // Note: findTextCoordinates uses pdf-parse logic on the buffer
                const matches = await findTextCoordinates(pdfBuffer, action.from);
                for (const match of matches) {
                    const page = pdfDoc.getPages()[match.pageIndex];
                    if (page) {
                        page.drawRectangle({
                            x: match.x,
                            y: match.y,
                            width: match.width,
                            height: match.height || 12,
                            color: rgb(1, 1, 1),
                        });
                        page.drawText(action.to, {
                            x: match.x,
                            y: match.y,
                            size: 10,
                            color: rgb(0, 0, 0),
                        });
                    }
                }
                break;
        }
    }

    if (hasStructuralChanges) {
        const newPdfDoc = await PDFDocument.create();
        const copiedPages = await newPdfDoc.copyPages(pdfDoc, pageIndicesToKeep);
        copiedPages.forEach(page => newPdfDoc.addPage(page));
        return Buffer.from(await newPdfDoc.save());
    } else {
        return Buffer.from(await pdfDoc.save());
    }
}
