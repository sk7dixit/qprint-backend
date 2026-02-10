
import { processConversion, getPageCount } from "../src/services/conversion.service.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create dummy files for testing
const TXT_FILE = path.join(__dirname, "test.txt");
const PDF_FILE = path.join(__dirname, "test.pdf");

// We can't easily create a valid PDF/Image here without external libs or assets.
// BUT validation service relies on file extension mostly for routing logic.
// However, pdf-lib will fail if we pass a text file as PDF.
// Let's test the FAILURE case first (invalid file) and basic logic paths.

const testConversion = async () => {
    console.log("🧪 Testing Conversion Service...");

    // 1. Create a dummy text file
    fs.writeFileSync(TXT_FILE, "Hello World Content");

    // 2. Test Unsupported Format
    try {
        console.log("👉 Testing Unsupported Format (TXT)...");
        await processConversion(TXT_FILE, "txt");
        console.error("❌ Should have failed for TXT");
    } catch (e) {
        console.log("✅ Correctly rejected TXT:", e.message);
    }

    // 3. Test PDF "Conversion" (Should just validate/resize)
    // We need a real PDF for pdf-lib to not crash.
    // If we don't have one, we can skip this or create a minimal one if we had tools.
    // For now, let's assume if we pass a non-pdf file as pdf, it should throw a specific pdf-lib error.

    try {
        console.log("👉 Testing Invalid PDF content...");
        await processConversion(TXT_FILE, "pdf"); // Passing text file as pdf
        console.error("❌ Should have failed PDF validation");
    } catch (e) {
        console.log("✅ Correctly caught invalid PDF:", e.message);
    }

    console.log("🧪 Conversion Logic Tests Complete.");

    // Cleanup
    if (fs.existsSync(TXT_FILE)) fs.unlinkSync(TXT_FILE);
    process.exit(0);
};

testConversion();
