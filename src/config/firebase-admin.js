import admin from "firebase-admin";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const serviceAccount = require("./firebase-admin.json");
import jwt from "jsonwebtoken";

let adminInitialized = false;

// 1. Initialize Firebase Admin
try {
    if (serviceAccount.private_key && serviceAccount.private_key !== "PLACEHOLDER") {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        adminInitialized = true;
        console.log("✅ Firebase Admin Security Layer: ACTIVE (Production Mode)");
    } else {
        console.error("❌ CRITICAL: Firebase Admin initialization failed. Service account keys are missing or invalid placeholders.");
    }
} catch (error) {
    console.error("❌ CRITICAL: Firebase Admin initialization failed:", error.message);
}

// 2. Auth Helper with strict check
export const verifyFirebaseToken = async (token) => {
    if (!adminInitialized) {
        throw new Error("Authentication service is unavailable (Firebase Admin not initialized)");
    }
    return await admin.auth().verifyIdToken(token);
};

export const db = adminInitialized ? admin.firestore() : null;
if (db) console.log("🔥 Firestore Security Layer: ACTIVE");

export default admin;
