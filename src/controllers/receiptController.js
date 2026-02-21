
import pool from "../config/db.js";
import { PDFDocument, StandardFonts } from "pdf-lib";

export const getReceipt = async (req, res) => {
    const { printJobId } = req.params;

    try {
        const result = await pool.query(
            `SELECT r.*, p.queue_number, s.name AS shop_name
       FROM payment_receipts r
       JOIN print_jobs p ON r.print_job_id = p.id
       JOIN shops s ON r.shop_id = s.id
       WHERE r.print_job_id = $1 AND r.user_id = $2`,
            [printJobId, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Receipt not found" });
        }

        const receipt = result.rows[0];

        // Check expiry
        if (new Date(receipt.expires_at) < new Date()) {
            return res.status(410).json({ error: "Receipt expired" });
        }

        // Generate PDF dynamically
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([400, 500]);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        page.drawText("Payment Receipt", { x: 120, y: 450, size: 18, font: boldFont });

        // Draw details
        const fontSize = 12;
        const startX = 50;
        let currentY = 420;
        const lineHeight = 20;

        page.drawText(`Receipt ID: ${receipt.id}`, { x: startX, y: currentY, size: fontSize, font });
        currentY -= lineHeight;
        page.drawText(`Values Print`, { x: startX, y: currentY, size: fontSize, font: boldFont }); // Branding
        currentY -= lineHeight;
        page.drawText(`Shop: ${receipt.shop_name}`, { x: startX, y: currentY, size: fontSize, font });
        currentY -= lineHeight;
        page.drawText(`Amount: Rs.${receipt.amount}`, { x: startX, y: currentY, size: fontSize, font });
        currentY -= lineHeight;
        page.drawText(`Queue No: ${receipt.queue_number}`, { x: startX, y: currentY, size: fontSize, font });
        currentY -= lineHeight;
        page.drawText(`Date: ${new Date(receipt.created_at).toLocaleString()}`, { x: startX, y: currentY, size: fontSize, font });

        currentY -= lineHeight * 2;
        page.drawText("Thank you for using our service!", { x: startX, y: currentY, size: 10, font });


        const pdfBytes = await pdfDoc.save();

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=receipt_${receipt.id}.pdf`);
        res.send(Buffer.from(pdfBytes));

    } catch (error) {
        console.error("Receipt generation error:", error);
        res.status(500).json({ error: "Failed to generate receipt" });
    }
};
