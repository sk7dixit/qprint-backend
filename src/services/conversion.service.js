import { exec } from "child_process";
import path from "path";

/**
 * Conversion Service - Uses LibreOffice headless to convert DOCX/PPT to PDF
 */
export const convertToPDF = (inputPath) => {
    return new Promise((resolve, reject) => {
        // LibreOffice command to convert to PDF in the same directory
        const outputDir = path.dirname(inputPath);
        exec(
            `libreoffice --headless --convert-to pdf --outdir "${outputDir}" "${inputPath}"`,
            (err, stdout, stderr) => {
                if (err) {
                    console.error("LibreOffice Error:", stderr);
                    return reject(err);
                }
                // Construct the expected PDF path
                const pdfPath = inputPath.replace(/\.[^/.]+$/, ".pdf");
                resolve(pdfPath);
            }
        );
    });
};

/**
 * Metadata Service - Stub for getting page count
 */
export const getPageCount = async (pdfPath) => {
    // In a real implementation, we'd use 'pdf-lib' or 'pdf-parse'
    // For now, return a random count between 1 and 10 for Step 7 demo
    return Math.floor(Math.random() * 10) + 1;
};
