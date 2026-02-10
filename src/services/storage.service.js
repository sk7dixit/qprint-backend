
import { createClient } from "@supabase/supabase-js";
import path from "path";
import fs from "fs";

// Initialize Supabase Client
// CRITICAL: Use SERVICE ROLE KEY for backend operations to bypass RLS if needed,
// or use standard key if we want to respect policies (but backend usually needs full access).
// For file uploads associated with a user, we might want to use the user's token, but here we are in a service.
// Let's use the Service Role Key for reliability in background jobs.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("StorageService: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BUCKET_NAME = "uploads"; // Ensure this bucket exists

/**
 * Storage Service - Uploads files to Supabase Storage
 * Returns the public URL or signed URL.
 */
export const uploadToStorage = async (filePath) => {
    try {
        const fileName = path.basename(filePath);
        const fileContent = fs.readFileSync(filePath);

        // Upload to Supabase
        // We use a simple path strategy: "converted/timestamp-filename" to avoid collisions
        const storagePath = `converted/${Date.now()}-${fileName}`;

        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(storagePath, fileContent, {
                contentType: 'application/pdf', // Assuming we are mostly uploading converted PDFs here
                upsert: false
            });

        if (error) {
            throw error;
        }

        // Get Public URL (if bucket is public)
        const { data: { publicUrl } } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(storagePath);

        // OR Signed URL (if bucket is private - recommended for user content)
        // For now, let's assume we want a signed URL valid for a long time or just use the path 
        // and let the frontend generate signed URLs on demand.
        // However, the controller expects a URL to store in the DB.
        // If we store the path, the frontend needs to know it's a path.
        // Let's return the PATH relative to the bucket, so the frontend can sign it.
        // BUT wait, existing implementation expects a URL.

        // Recommendation: Store the FULL PATH (bucket + path) or just the path and have a robust getter.
        // Let's return the 'path' property from data, which is usually `converted/timestamp-filename`.
        return data.path;

    } catch (error) {
        console.error("Storage Service Error:", error);
        throw error;
    }
};


/**
 * Download file from Supabase Storage
 * Returns a Buffer
 */
export const downloadFile = async (storagePath) => {
    try {
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .download(storagePath);

        if (error) throw error;

        return Buffer.from(await data.arrayBuffer());
    } catch (error) {
        console.error("Storage Download Error:", error);
        throw error;
    }
};

/**
 * Generate Signed URL for a given path
 */
export const getSignedUrl = async (path) => {
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(path, 60 * 60); // 1 hour

    if (error) throw error;
    return data.signedUrl;
}
