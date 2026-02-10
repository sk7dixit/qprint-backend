
import admin from "../src/config/firebase-admin.js";
import { verifyFirebaseToken } from "../src/config/firebase-admin.js";
import { db } from "../src/config/firebase-admin.js";

const testFirebase = async () => {
    console.log("Testing Firebase Admin Config...");

    try {
        if (!admin) {
            console.error("❌ Admin export is null/undefined");
        } else {
            console.log("✅ Admin export present");
            // Check internal state if possible, or just trust the log from the file
        }

        if (db) {
            console.log("✅ Firestore initialized");
        } else {
            console.error("❌ Firestore NOT initialized");
        }

        console.log("Test complete.");
        process.exit(0);

    } catch (error) {
        console.error("❌ Test Failed:", error);
        process.exit(1);
    }
};

testFirebase();
