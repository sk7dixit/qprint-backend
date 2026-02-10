import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import pkg from 'pg';
const { Client } = pkg;

const firebaseConfig = {
    apiKey: "AIzaSyCvAOxtTvJsIUHFW3O1ubMHZjWSJEMuY0Q",
    authDomain: "qprint-8dc35.firebaseapp.com",
    projectId: "qprint-8dc35",
    storageBucket: "qprint-8dc35.firebasestorage.app",
    messagingSenderId: "577253444995",
    appId: "1:577253444995:web:46f1d9098bd4ef352abab6"
};

const DATABASE_URL = "postgresql://neondb_owner:npg_RSZfQ57azcEK@ep-empty-star-a1so8gi5-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

const adminEmail = "qprint92@gmail.com";
const adminPassword = "Admin@123";

async function bootstrap() {
    console.log("🚀 Starting Administrative Bootstrap...");

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = new Client({ connectionString: DATABASE_URL });

    try {
        console.log(`Step 1: Establishing identity for ${adminEmail}...`);
        let user;
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
            user = userCredential.user;
            console.log("✅ Firebase identity created.");
        } catch (err) {
            if (err.code === 'auth/email-already-in-use') {
                console.log("ℹ️ Identity exists in Firebase. Signing in to retrieve UID...");
                try {
                    const userCredential = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
                    user = userCredential.user;
                    console.log("✅ Authenticated successfully.");
                } catch (loginErr) {
                    console.error("❌ Could not login to existing account. Password might be different.");
                    throw loginErr;
                }
            } else {
                throw err;
            }
        }

        console.log(`Step 2: Connecting to Database (UID: ${user.uid})...`);
        await db.connect();

        // Check if user exists in DB by UID or Email
        const checkRes = await db.query("SELECT * FROM users WHERE uid = $1 OR email = $2", [user.uid, adminEmail]);

        if (checkRes.rows.length > 0) {
            const existingUser = checkRes.rows[0];
            console.log(`Step 3: Promoting existing record (ID: ${existingUser.id}) to 'admin'...`);
            await db.query(`
                UPDATE users 
                SET role = 'admin', 
                    is_profile_complete = true, 
                    uid = $1  -- Ensure UID matches Firebase
                WHERE id = $2
            `, [user.uid, existingUser.id]);
            console.log("✅ Database record updated and promoted.");
        } else {
            console.log("Step 3: Creating new admin record in database...");
            await db.query(
                "INSERT INTO users (uid, email, name, role, is_profile_complete) VALUES ($1, $2, $3, $4, $5)",
                [user.uid, adminEmail, "Master Admin", "admin", true]
            );
            console.log("✅ Database record created and promoted.");
        }

        console.log("\n✨ BOOTSTRAP SUCCESSFUL.");
        console.log("Identity: qprint92@gmail.com");
        console.log("Password: Admin@123");

    } catch (error) {
        console.error("❌ Bootstrap failed:", error.message);
        if (error.code) console.error("Error Code:", error.code);
    } finally {
        await db.end();
        process.exit();
    }
}

bootstrap();
