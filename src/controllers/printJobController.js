import pool from "../config/db.js";
import { emitToShop, emitToUser } from "../services/socketService.js";
import { uploadToStorage, downloadFile } from "../services/storage.service.js"; // Import storage helpers
export const createPrintJob = async (req, res) => {
    const { shop_id, draft_id, print_options } = req.body;

    if (!shop_id || !draft_id || !print_options) {
        return res.status(400).json({ error: "Missing required fields: shop_id, draft_id, print_options" });
    }

    try {
        // 1. Fetch Draft to validate and calculate price
        const draftResult = await pool.query("SELECT * FROM print_job_drafts WHERE id = $1 AND user_id::text = $2::text", [draft_id, String(req.user.id)]);

        if (draftResult.rows.length === 0) {
            return res.status(404).json({ error: "Draft not found" });
        }

        const draft = draftResult.rows[0];

        // Security: Ensure draft is ready for print
        if (draft.status !== 'ready_for_print') {
            return res.status(400).json({ error: "Draft is not ready. Please review it first." });
        }

        // 2. Fetch Shop Pricing
        const shopResult = await pool.query("SELECT * FROM shops WHERE id = $1", [shop_id]);
        if (shopResult.rows.length === 0) return res.status(404).json({ error: "Shop not found" });

        const shop = shopResult.rows[0];

        // Security: Ensure shop is open
        if (!shop.is_open) {
            return res.status(400).json({ error: "This shop is currently closed. Please select another shop." });
        }

        // Pricing Logic
        const pricePerPage = print_options.color === 'color'
            ? (shop.price_color_a4 || 8)
            : (shop.price_bw_a4 || 2);
        const copies = print_options.copies || 1;
        const totalAmount = draft.page_count * pricePerPage * copies;

        // 3. Queue Logic
        const queueQuery = `
            SELECT COUNT(*) FROM print_jobs
            WHERE shop_id = $1
            AND DATE(created_at) = CURRENT_DATE
        `;
        const queueResult = await pool.query(queueQuery, [shop_id]);
        const queueNumber = Number(queueResult.rows[0].count) + 1;

        // 4. Create Print Job (Pending Payment)
        const insertQuery = `
            INSERT INTO print_jobs (user_id, shop_id, draft_id, print_options, amount, payment_status, queue_number, status, file_id)
            VALUES ($1, $2, $3, $4, $5, 'pending', $6, 'created', NULL)
            RETURNING *;
        `;

        const printJobResult = await pool.query(insertQuery, [
            String(req.user.id), shop_id, draft_id, print_options, totalAmount, queueNumber
        ]);

        res.status(201).json({
            success: true,
            printJob: printJobResult.rows[0],
            amount: totalAmount,
            message: "Print job created. Proceed to payment."
        });

    } catch (error) {
        console.error("Print job creation error:", error);
        res.status(500).json({ error: "Failed to create print job" });
    }
};

/**
 * Verify Payment & Finalize Print Job
 */
export const verifyPayment = async (req, res) => {
    const { printJobId, paymentId } = req.body;

    if (!printJobId || !paymentId) {
        return res.status(400).json({ error: "Missing printJobId or paymentId" });
    }

    try {
        // 1. Get Print Job
        const printJobResult = await pool.query("SELECT * FROM print_jobs WHERE id = $1 AND user_id = $2", [printJobId, req.user.id]);
        if (printJobResult.rows.length === 0) return res.status(404).json({ error: "Print job not found" });

        const printJob = printJobResult.rows[0];

        if (printJob.payment_status === 'paid') {
            return res.status(200).json({ message: "Already paid", printJob });
        }

        // 2. Get Draft
        const draftResult = await pool.query("SELECT * FROM print_job_drafts WHERE id = $1", [printJob.draft_id]);
        const draft = draftResult.rows[0];

        // 3. LOCK & COPY (The most important part)
        let finalPdfPath;
        try {
            const pdfBuffer = await downloadFile(draft.converted_pdf_url);
            const tempName = `final_${printJobId}.pdf`;
            const tempPath = path.join(process.cwd(), 'uploads', tempName);
            if (!fs.existsSync(path.dirname(tempPath))) {
                fs.mkdirSync(path.dirname(tempPath), { recursive: true });
            }
            fs.writeFileSync(tempPath, pdfBuffer);
            finalPdfPath = await uploadToStorage(tempPath);
            fs.unlinkSync(tempPath);
        } catch (storageError) {
            console.error("Failed to finalize PDF:", storageError);
            return res.status(500).json({ error: "Payment verification failed during file finalization." });
        }

        // 4. Update Print Job (Paid, Queued, Final PDF)
        const updateQuery = `
            UPDATE print_jobs 
            SET payment_status = 'paid', status = 'queued', final_pdf_url = $1, file_id = $2
            WHERE id = $3
            RETURNING *;
        `;

        // Insert into files table to get a valid file_id
        const fileInsert = await pool.query(
            "INSERT INTO files (user_id, filename, file_url, page_count, file_type) VALUES ($1, $2, $3, $4, 'pdf') RETURNING id",
            [req.user.id, `PrintJob_${printJobId}.pdf`, finalPdfPath, draft.page_count]
        );
        const newFileId = fileInsert.rows[0].id;

        const updatedJobResult = await pool.query(updateQuery, [finalPdfPath, newFileId, printJobId]);
        const updatedJob = updatedJobResult.rows[0];

        // 5. FREEZE Draft (Immutable)
        await pool.query("UPDATE print_job_drafts SET status = 'printed' WHERE id = $1", [printJob.draft_id]);

        // 6. Notify Shop
        emitToShop(printJob.shop_id, "printJobCreated", updatedJob);
        emitToUser(req.user.id, "printJobPaid", updatedJob);

        res.status(200).json({
            success: true,
            printJob: updatedJob,
            message: "Payment successful. Job sent to shop."
        });

    } catch (error) {
        console.error("Verify payment error:", error);
        res.status(500).json({ error: "Verification failed" });
    }
};

export const getPrintHistory = async (req, res) => {
    try {
        const query = `
            SELECT pj.*, s.name AS shop_name, d.original_file_name AS filename, d.original_file_url AS file_url 
            FROM print_jobs pj
            LEFT JOIN shops s ON pj.shop_id = s.id
            LEFT JOIN print_job_drafts d ON pj.draft_id = d.id
            WHERE pj.user_id::text = $1::text
            ORDER BY pj.created_at DESC
        `;
        const result = await pool.query(query, [String(req.user.id)]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Fetch history error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getActiveShops = async (req, res) => {
    try {
        const query = `
            SELECT id, name, location, is_open, price_bw_a4, price_color_a4
            FROM shops
            WHERE is_active = true
            ORDER BY name ASC
        `;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Fetch shops error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getShopPrintJobs = async (req, res) => {
    try {
        const query = `
            SELECT pj.*, u.name AS display_name, d.original_file_name AS filename
            FROM print_jobs pj
            LEFT JOIN users u ON pj.user_id::text = u.id::text
            LEFT JOIN print_job_drafts d ON pj.draft_id = d.id
            WHERE pj.shop_id = $1
            AND DATE(pj.created_at) = CURRENT_DATE
            ORDER BY pj.queue_number ASC
        `;
        const result = await pool.query(query, [req.user.shop_id]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Fetch shop jobs error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const updatePrintJobStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['queued', 'accepted', 'printing', 'ready', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
    }

    try {
        const query = `UPDATE print_jobs SET status = $1 WHERE id = $2 RETURNING *;`;
        const result = await pool.query(query, [status, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Print job not found" });
        }

        const updatedJob = result.rows[0];

        // Real-time notifications
        emitToUser(updatedJob.user_id, "statusUpdated", updatedJob);
        emitToShop(updatedJob.shop_id, "statusUpdated", updatedJob);

        res.status(200).json({ success: true, printJob: updatedJob });
    } catch (error) {
        console.error("Update status error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
