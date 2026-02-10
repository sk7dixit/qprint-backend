import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { PDFDocument } from 'pdf-lib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CONFIG
const BASE_URL = "http://localhost:5000/api";
// You need a valid JWT token here. 
// For this test script to work standalone, we might need a way to login or hardcode a dev token.
// Assuming we can login as a user first.

const TEST_FILES_DIR = path.join(__dirname, "test_files");

// MOCK USER CREDENTIALS (Ensure this user exists in your local DB)
const EMAIL = "test@example.com";
const PASSWORD = "password123";

async function runTest() {
    try {
        console.log("1. Authenticating...");
        // This assumes you have an auth login endpoint. 
        // If not, we might need to manually generate a token or skip this if global test mode is on.
        // Adjusting to your specific auth flow.
        // Existing codebase uses Firebase Auth heavily? 
        // If the backend expects a Firebase token, we might need to mock the middleware or use a real Firebase ID token.
        // Let's check authRoutes.js... 
        // Wait, I can't check it inside the script.
        // Strategy: I will try to hit the backend. If 401, I'll prompt (or fail).

        // Actually, for local dev verification, I can perhaps bypass auth or use a known test token if available.
        // Let's assume for now I need to purely test the logic. 
        // I will rely on the developer (me) to provide a valid token if strict auth is on.

        // Placeholder for token
        // Placeholder for token
        const token = "DEV_TEST_TOKEN";

        // 2. Upload a File
        console.log("2. Uploading a test file...");
        // Create a dummy PDF if it doesn't exist
        if (!fs.existsSync(TEST_FILES_DIR)) fs.mkdirSync(TEST_FILES_DIR);
        const dummyPdfPath = path.join(TEST_FILES_DIR, "test.pdf");


        // Create a valid PDF using pdf-lib
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage();
        page.drawText('Test PDF content');
        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync(dummyPdfPath, pdfBytes);

        const formData = new FormData();
        formData.append("file", fs.createReadStream(dummyPdfPath));
        formData.append("source", "shop");

        const uploadRes = await axios.post(`${BASE_URL}/print-drafts/upload`, formData, {
            headers: {
                ...formData.getHeaders(),
                "Authorization": `Bearer ${token}`
            }
        });

        const { draftId, status } = uploadRes.data;
        console.log(`   -> Uploaded! Draft ID: ${draftId}, Status: ${status}`);

        // 3. Poll Status
        console.log("3. Polling status...");
        let attempts = 0;
        const maxAttempts = 10;

        const poll = setInterval(async () => {
            attempts++;
            try {
                const statusRes = await axios.get(`${BASE_URL}/print-drafts/${draftId}/status`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });

                const currentStatus = statusRes.data.status;
                console.log(`   [Attempt ${attempts}] Status: ${currentStatus}`);

                if (currentStatus === "ready_for_preview" || currentStatus === "conversion_failed") {
                    clearInterval(poll);
                    console.log(`Final Status: ${currentStatus}`);
                    if (currentStatus === "ready_for_preview") {
                        console.log(`Converted PDF URL: ${statusRes.data.converted_pdf_url}`);
                        console.log("SUCCESS");
                    } else {
                        console.log("FAILED");
                    }
                }

                if (attempts >= maxAttempts) {
                    clearInterval(poll);
                    console.log("TIMEOUT");
                }

            } catch (err) {
                console.error("Polling error:", err.message);
                clearInterval(poll);
            }
        }, 1000);

    } catch (error) {
        console.error("Test Failed:", error.message);
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);
        }
    }
}

// Ensure directory exists
if (!fs.existsSync(TEST_FILES_DIR)) {
    fs.mkdirSync(TEST_FILES_DIR);
}

runTest();
