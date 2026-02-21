import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import pool from "./src/config/db.js";

const firebaseConfig = {
    apiKey: "AIzaSyCvAOxtTvJsIUHFW3O1ubMHZjWSJEMuY0Q",
    authDomain: "qprint-8dc35.firebaseapp.com",
    projectId: "qprint-8dc35",
    storageBucket: "qprint-8dc35.firebasestorage.app",
    messagingSenderId: "577253444995",
    appId: "1:577253444995:web:46f1d9098bd4ef352abab6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function runTest() {
    try {
        console.log("1. Signing in...");
        const userCredential = await signInWithEmailAndPassword(auth, "qprint92@gmail.com", "Admin@123");
        const user = userCredential.user;
        const token = await user.getIdToken();
        console.log("✅ Logged in as:", user.email);

        const userRes = await pool.query("SELECT id FROM users WHERE uid = $1", [user.uid]);
        if (userRes.rows.length === 0) throw new Error("User not found in Postgres");
        const userId = userRes.rows[0].id;

        // 2. Create Dummy Draft (Ready for Print)
        console.log("2. Creating Dummy Draft in DB...");
        const draftRes = await pool.query(`
            INSERT INTO print_job_drafts 
            (user_id, original_file_name, original_file_type, original_file_url, converted_pdf_url, page_count, status)
            VALUES ($1, 'payment_test.pdf', 'application/pdf', 'mock_url', 'mock_url', 5, 'ready_for_print')
            RETURNING id;
        `, [userId]);
        const draftId = draftRes.rows[0].id;
        console.log("✅ Created Draft ID:", draftId);

        // 3. Get Shop ID
        const shopRes = await pool.query("SELECT id FROM shops LIMIT 1"); // Assuming a shop exists
        if (shopRes.rows.length === 0) throw new Error("No shops found");
        const shopId = shopRes.rows[0].id;

        // 4. Create Print Job (Pending Payment)
        console.log("3. Creating Print Job...");
        const printOpts = { color: 'bw', copies: 1, layout: 'portrait', duplex: 'simplex' };

        // We can call the API or insert directly. Calling API is better to test logic.
        const createJobRes = await fetch("http://localhost:5000/api/print-jobs/create", {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ shop_id: shopId, draft_id: draftId, print_options: printOpts })
        });

        let printJobId;
        if (createJobRes.ok) {
            const jobData = await createJobRes.json();
            printJobId = jobData.printJob.id;
            console.log("✅ Created Print Job ID:", printJobId);
        } else {
            // Fallback: Insert manually if API fails (but API should work)
            console.error("❌ Failed to create print job via API:", await createJobRes.text());
            return;
        }

        // 5. Verify Payment
        console.log("4. Verifying Payment...");
        const verifyRes = await fetch("http://localhost:5000/api/print-jobs/verify-payment", {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ printJobId: printJobId, paymentId: "test_payment_123" }) // API endpoint expects printJobId/paymentId
        });

        const verifyData = await verifyRes.json();
        console.log("Verify Response:", verifyRes.status);
        console.log("Verify Data:", JSON.stringify(verifyData, null, 2));

        if (verifyRes.ok) {
            console.log("🎉 SUCCESS: Payment Verified & Job Finalization Queued!");
        } else {
            console.error("❌ FAILED: Payment Verification Rejected");
        }

    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        await pool.end();
        process.exit();
    }
}

runTest();
