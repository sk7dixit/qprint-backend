import pool from "../config/db.js";
import { convertToPDF, getPageCount } from "../services/conversion.service.js";
import { uploadToStorage } from "../services/storage.service.js";

export const uploadFile = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    const { path: tempPath, originalname } = req.file;
    const ext = originalname.split(".").pop().toLowerCase();

    try {
        let pdfPath;
        if (ext === "pdf") {
            pdfPath = tempPath;
        } else {
            console.log(`[FileController] Converting ${originalname} to PDF...`);
            pdfPath = await convertToPDF(tempPath);
        }

        console.log(`[FileController] Uploading to Storage...`);
        const pdfUrl = await uploadToStorage(pdfPath);
        const pageCount = await getPageCount(pdfPath);

        // Save to Database
        const query = `
            INSERT INTO files (user_id, filename, file_url, file_type, page_count, status)
            VALUES ($1, $2, $3, $4, $5, 'ready')
            RETURNING *;
        `;
        const values = [req.user.id, originalname, pdfUrl, ext, pageCount];
        const result = await pool.query(query, values);

        res.status(200).json({
            status: "ready",
            file: result.rows[0],
            pdfUrl,
            pageCount
        });
    } catch (error) {
        console.error("File processing error:", error);
        res.status(500).json({ error: "File preparation failed" });
    }
};

export const getFiles = async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM files WHERE user_id = $1 ORDER BY created_at DESC",
            [req.user.id]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Fetch files error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
