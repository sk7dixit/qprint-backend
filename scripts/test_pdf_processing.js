
import { PDFDocument, PageSizes } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { applyPDFActions } from '../src/services/pdf.service.js';

const TEST_FILE = 'test_pdf_processing.pdf';

async function createDummyPDF() {
    const pdfDoc = await PDFDocument.create();
    // Page 1
    const page1 = pdfDoc.addPage(PageSizes.A4);
    page1.drawText('Page 1', { x: 50, y: 700, size: 50 });

    // Page 2
    const page2 = pdfDoc.addPage(PageSizes.A4);
    page2.drawText('Page 2', { x: 50, y: 700, size: 50 });

    // Page 3
    const page3 = pdfDoc.addPage(PageSizes.A4);
    page3.drawText('Page 3', { x: 50, y: 700, size: 50 });

    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(TEST_FILE, pdfBytes);
    console.log(`Created ${TEST_FILE} with 3 pages.`);
    return path.resolve(TEST_FILE);
}

async function runTests() {
    try {
        const filePath = await createDummyPDF();

        console.log('--- Test 1: Rotate Page 1 by 90 degrees ---');
        await applyPDFActions(filePath, [{ type: 'rotate_page', pageIndex: 0, degrees: 90 }]);
        console.log('Applied rotation.');

        console.log('--- Test 2: Delete Page 2 (Index 1) ---');
        // Re-create to keep state clean or continue? Let's continue.
        // Current state: P1(Rotated), P2, P3. Indices: 0, 1, 2.
        await applyPDFActions(filePath, [{ type: 'delete_page', pageIndex: 1 }]);
        console.log('Applied deletion.');

        // Current state: P1(Rotated), P3.

        console.log('--- Test 3: Reorder (Swap) ---');
        // Let's reset file
        const freshPath = await createDummyPDF();
        // P1, P2, P3.
        await applyPDFActions(freshPath, [{ type: 'reorder_pages', newOrder: [2, 0, 1] }]);
        // Expected: P3, P1, P2.
        console.log('Applied reorder.');

        console.log('✅ PDF Processing Tests Completed locally.');

        // Cleanup
        // await fs.unlink(TEST_FILE);
        // await fs.unlink(freshPath);

    } catch (error) {
        console.error('❌ Test Failed:', error);
    }
}

runTests();
