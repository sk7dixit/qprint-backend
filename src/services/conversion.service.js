
import { exec } from "child_process";
import path from "path";
import fs from "fs/promises";
import { PDFDocument, PageSizes } from "pdf-lib";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Master Conversion Function
 * Routes to specific converters based on file type
 */
export const processConversion = async (inputPath, fileType) => {
    const ext = fileType.toLowerCase().replace('.', '');

    try {
        // Case 1: PDF - Validate only
        if (ext === 'pdf') {
            const isValid = await validatePDF(inputPath);
            if (!isValid) throw new Error("Invalid or corrupted PDF");
            return inputPath;
        }

        // Case 2: Office Documents (DOC, DOCX, PPT, PPTX)
        if (['doc', 'docx', 'ppt', 'pptx'].includes(ext)) {
            return await convertOfficeToPDF(inputPath);
        }

        // Case 3: Images (JPG, PNG)
        if (['jpg', 'jpeg', 'png'].includes(ext)) {
            return await imagesToPDF([inputPath]);
        }

        throw new Error(`Unsupported file type: ${fileType}`);

    } catch (error) {
        console.error(`[ConversionService] Error processing ${fileType}:`, error);
        throw error;
    }
};

/**
 * Office to PDF Conversion using LibreOffice
 */
const convertOfficeToPDF = async (inputPath) => {
    const outputDir = path.dirname(inputPath);
    // Explicitly construct expected output filename
    const basename = path.basename(inputPath, path.extname(inputPath));
    // LibreOffice handles filenames by stripping extension and appending .pdf
    const expectedPdfPath = path.join(outputDir, `${basename}.pdf`);

    // Command to convert
    // --headless: no UI
    // --convert-to pdf: target format
    // --outdir: output location
    // We add --nologo --nofirststartwizard for slightly faster/cleaner init
    const command = `soffice --headless --convert-to pdf --outdir "${outputDir}" "${inputPath}"`;

    try {
        console.log(`[ConversionService] Executing: ${command}`);
        await execAsync(command);

        // Verify file was created
        try {
            await fs.access(expectedPdfPath);
        } catch {
            throw new Error("LibreOffice command ran but PDF was not found at expected path: " + expectedPdfPath);
        }

        return expectedPdfPath;
    } catch (error) {
        console.error("LibreOffice Conversion Error:", error);
        // Provide a clearer error message about the dependency
        if (error.message.includes('Command failed')) {
            throw new Error("LibreOffice conversion failed. Please ensure 'soffice' is in your system PATH.");
        }
        throw new Error("Office document conversion failed.");
    }
};

/**
 * Image to PDF Conversion
 * Wraps one or more images into an A4 PDF
 */
export const imagesToPDF = async (imagePaths) => {
    const pdfDoc = await PDFDocument.create();

    for (const imgPath of imagePaths) {
        let imgBytes;
        try {
            imgBytes = await fs.readFile(imgPath);
        } catch (e) {
            console.error(`Failed to read image ${imgPath}:`, e);
            continue;
        }

        const ext = path.extname(imgPath).toLowerCase();

        let image;
        try {
            if (ext === '.jpg' || ext === '.jpeg') {
                image = await pdfDoc.embedJpg(imgBytes);
            } else if (ext === '.png') {
                image = await pdfDoc.embedPng(imgBytes);
            } else {
                console.warn(`Skipping unsupported image type: ${ext}`);
                continue;
            }
        } catch (e) {
            console.error(`Failed to embed image ${imgPath}:`, e);
            continue;
        }

        // Add A4 page
        const page = pdfDoc.addPage(PageSizes.A4);
        const { width, height } = page.getSize();

        // Define margins
        const margin = 20;
        const availableWidth = width - (margin * 2);
        const availableHeight = height - (margin * 2);

        // Scale image to fit within margins while maintaining aspect ratio
        const dims = image.scaleToFit(availableWidth, availableHeight);

        // Center image
        page.drawImage(image, {
            x: (width - dims.width) / 2,
            y: (height - dims.height) / 2,
            width: dims.width,
            height: dims.height,
        });
    }

    if (pdfDoc.getPageCount() === 0) {
        throw new Error("No valid images could be converted to PDF");
    }

    const pdfBytes = await pdfDoc.save();
    // Use the first image name as base + timestamp to ensure uniqueness locally
    const outputPath = imagePaths[0] + `.converted.${Date.now()}.pdf`;
    await fs.writeFile(outputPath, pdfBytes);
    return outputPath;
};

/**
 * Validate PDF and Return Page Count
 */
export const validatePDF = async (pdfPath) => {
    try {
        const data = await fs.readFile(pdfPath);
        const pdfDoc = await PDFDocument.load(data, { ignoreEncryption: true });
        return pdfDoc.getPageCount() > 0;
    } catch (error) {
        console.error("PDF Validation Error:", error);
        return false;
    }
};

/**
 * Get PDF Page Count
 */
export const getPageCount = async (pdfPath) => {
    try {
        const data = await fs.readFile(pdfPath);
        const pdfDoc = await PDFDocument.load(data, { ignoreEncryption: true });
        return pdfDoc.getPageCount();
    } catch (error) {
        return 0;
    }
};

// Backwards compatibility alias
export const convertToPDF = convertOfficeToPDF;
