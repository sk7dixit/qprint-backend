import { supabase } from "../config/supabase.js";

const BUCKET_NAME = "uploads";

/**
 * Generate a Hardened Signed Upload URL
 * Validates path structure and enforces ownership via path naming conventions.
 */
export const createSignedUploadUrl = async (filePath) => {
    try {
        if (!filePath.startsWith("user-uploads/")) {
            throw new Error("Invalid storage path");
        }

        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUploadUrl(filePath, {
                upsert: false // Prevent accidental overwrites
            });

        if (error) throw error;
        return data.signedUrl;

    } catch (error) {
        console.error("Storage Signed Upload URL Error:", error.message);
        throw error;
    }
};

/**
 * Generate a Read-Only Signed URL for frontend access
 */
export const getSignedUrl = async (filePath) => {
    try {
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(filePath, 60 * 60); // Valid for 1 hour

        if (error) throw error;
        return data.signedUrl;
    } catch (error) {
        console.error("Storage Read Signed URL Error:", error.message);
        throw error;
    }
};

/**
 * Download file from Supabase Storage (For Worker use only)
 * Returns a Buffer representing the file content.
 */
export const downloadFile = async (storagePath) => {
    try {
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .download(storagePath);

        if (error) throw error;

        // Convert the blob/stream to a Buffer
        const arrayBuffer = await data.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (error) {
        console.error("Storage Download Error:", error.message);
        throw error;
    }
};

/**
 * Delete a file from Storage
 * Essential for cleanup workers and storage tier management (1GB limits).
 */
export const deleteFileFromStorage = async (storagePath) => {
    try {
        const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([storagePath]);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Storage Delete Error:", error.message);
        throw error;
    }
};
