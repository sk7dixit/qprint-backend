import pool from "../config/db.js";
import { createSignedUploadUrl } from "../services/storage.service.js";
import { getPageCount } from "../services/conversion.service.js";

/**
 * Step 1: Generate Signed Upload URL
 */
export const generateUploadUrl = async (req, res) => {
    try {
        const { fileName, fileType } = req.body;
        if (!fileName) return res.status(400).json({ error: "fileName is required" });

        const userId = req.user.id;
        const timestamp = Date.now();
        const filePath = `user-uploads/${userId}/${timestamp}-${fileName}`;

        const uploadUrl = await createSignedUploadUrl(filePath);

        res.json({
            success: true,
            uploadUrl,
            filePath,
            bucketName: "uploads"
        });
    } catch (error) {
        console.error("❌ [FileController] Signed URL Error:", error.message);
        res.status(500).json({ error: "Failed to generate upload URL" });
    }
};

/**
 * Step 2: Finalize Upload (Store Metadata)
 * Frontend calls this after direct Supabase upload
 */
export const uploadFile = async (req, res) => {
    const { filePath, fileName, pageCount: providedPageCount } = req.body;

    if (!filePath) {
        return res.status(400).json({ error: "filePath is required" });
    }

    // Validate ownership
    if (!filePath.startsWith(`user-uploads/${req.user.id}/`)) {
        return res.status(403).json({ error: "Invalid file path" });
    }

    try {
        const ext = fileName?.split(".").pop().toLowerCase() || "pdf";
        const pageCount = Number(providedPageCount);

        if (!Number.isInteger(pageCount) || pageCount <= 0) {
            return res.status(400).json({ error: "Invalid page count" });
        }

        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

        // Save to Database
        const query = `
            INSERT INTO files (user_id, filename, file_url, file_type, page_count, status, expires_at)
            VALUES ($1, $2, $3, $4, $5, 'UPLOADED', $6)
            RETURNING *;
        `;
        const values = [
            req.user.id,
            fileName || "unnamed",
            filePath,
            ext,
            pageCount,
            expiresAt
        ];
        const result = await pool.query(query, values);

        res.status(200).json({
            status: "UPLOADED",
            file: result.rows[0],
            filePath,
            pageCount
        });
    } catch (error) {
        console.error("❌ [FileController] Metadata Sync Error:", error.message);
        res.status(500).json({ error: "Failed to sync file metadata" });
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
