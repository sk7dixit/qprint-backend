
import fs from 'fs';
import FormData from 'form-data';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import dotenv from 'dotenv';
import http from 'http';

// Load env vars from backend root (one level up from scripts)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import app AFTER env is loaded
import app from '../src/app.js';

const TEST_FILE_PATH = path.join(__dirname, 'dummy.txt');

const testUpload = async () => {
    console.log("🚀 Starting Draft Upload Test (Self-Contained)...");

    if (!fs.existsSync(TEST_FILE_PATH)) {
        fs.writeFileSync(TEST_FILE_PATH, "Dummy content for testing upload.");
    }

    // Start ephemeral server
    const server = http.createServer(app);

    // Listen on random port
    server.listen(0, async () => {
        const port = server.address().port;
        const API_URL = `http://localhost:${port}/api/print-drafts/upload`;
        console.log(`Test server running on port ${port}`);

        const form = new FormData();
        form.append('file', fs.createReadStream(TEST_FILE_PATH));
        form.append('source', 'shop');

        try {
            const response = await axios.post(API_URL, form, {
                headers: {
                    'Authorization': 'Bearer DEV_TEST_TOKEN',
                    ...form.getHeaders()
                },
                validateStatus: () => true
            });

            console.log(`Response Status: ${response.status}`);
            console.log('Response Data:', response.data);

            if (response.status === 201 && response.data.draftId) {
                console.log("✅ Draft created successfully!");
                console.log("Draft ID:", response.data.draftId);
                server.close();
                process.exit(0);
            } else {
                console.error("❌ Upload failed.");
                server.close();
                process.exit(1);
            }

        } catch (error) {
            console.error("❌ Request failed:", error.message);
            if (error.response) {
                console.error("Server Error Data:", error.response.data);
            }
            server.close();
            process.exit(1);
        }
    });
};

testUpload();
