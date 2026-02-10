
import axios from 'axios';
import http from 'http';
import app from '../src/app.js';
import pool from '../src/config/db.js';

const testOrderFlow = async () => {
    console.log("🚀 Starting Order & Payment Flow Test...");

    const server = http.createServer(app);

    server.listen(0, async () => {
        const port = server.address().port;
        const BASE_URL = `http://localhost:${port}/api/orders`;
        console.log(`Test server running on port ${port}`);

        try {
            // Prerequisite: Draft 3 must be in 'ready_for_checkout' status
            // We previously set it to 'ready_for_preview'.
            // Let's manually advance it to 'ready_for_checkout' as the Checkout frontend would do via patch.

            console.log("🛠️ Preparing draft 3 for checkout...");
            await pool.query("UPDATE print_job_drafts SET status = 'ready_for_checkout' WHERE id = 3");

            // 1. Create Order
            console.log("🧪 Testing Order Creation...");
            const createRes = await axios.post(`${BASE_URL}/create`, {
                shop_id: 11, // Use valid shop ID from DB
                draft_id: 3,
                print_options: {
                    color: 'bw',
                    copies: 2
                }
            }, {
                headers: { 'Authorization': 'Bearer DEV_TEST_TOKEN' }
            });

            const order = createRes.data.order;
            console.log(`✅ Order created! ID: ${order.id}, Amount: ${order.amount}`);

            // 2. Verify Payment
            console.log("🧪 Testing Payment Verification (Lock & Copy)...");
            const verifyRes = await axios.post(`${BASE_URL}/verify-payment`, {
                orderId: order.id,
                paymentId: 'MOCK_PAY_123'
            }, {
                headers: { 'Authorization': 'Bearer DEV_TEST_TOKEN' }
            });

            if (verifyRes.data.success) {
                console.log("✅ Payment Verified & Order Finalized!");
                console.log("   Final PDF URL:", verifyRes.data.order.final_pdf_url);
            }

            // 3. Verify Draft is frozen
            const draftRes = await pool.query("SELECT status FROM print_job_drafts WHERE id = 3");
            console.log("Draft Final Status:", draftRes.rows[0].status);
            if (draftRes.rows[0].status === 'ordered') {
                console.log("✅ Draft is correctly frozen (status: ordered)");
            }

            server.close();
            process.exit(0);

        } catch (error) {
            console.error("❌ Order flow failed:", error.message);
            if (error.response) console.error("Data:", error.response.data);
            server.close();
            process.exit(1);
        }
    });
};

testOrderFlow();
