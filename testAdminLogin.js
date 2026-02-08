import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyCvAOxtTvJsIUHFW3O1ubMHZjWSJEMuY0Q",
    authDomain: "qprint-8dc35.firebaseapp.com",
    projectId: "qprint-8dc35",
    storageBucket: "qprint-8dc35.firebasestorage.app",
    messagingSenderId: "577253444995",
    appId: "1:577253444995:web:46f1d9098bd4ef352abab6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function testLogin() {
    try {
        console.log("1. Signing in to Firebase...");
        const userCredential = await signInWithEmailAndPassword(auth, "qprint92@gmail.com", "Admin@123");
        const user = userCredential.user;

        console.log("✅ Firebase login successful");
        console.log("   UID:", user.uid);
        console.log("   Email:", user.email);

        console.log("\n2. Getting ID Token...");
        const token = await user.getIdToken();
        console.log("✅ Token obtained (length:", token.length, ")");

        console.log("\n3. Calling backend /api/auth/profile...");
        const response = await fetch(`http://localhost:5000/api/auth/profile/${user.uid}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log("   Status:", response.status, response.statusText);

        if (response.ok) {
            const data = await response.json();
            console.log("✅ Backend response:", JSON.stringify(data, null, 2));

            if (data.role === 'admin') {
                console.log("\n🎯 SUCCESS: Admin login fully operational!");
            } else {
                console.log("\n❌ FAIL: Role is not 'admin', got:", data.role);
            }
        } else {
            const errorText = await response.text();
            console.log("❌ Backend rejected request");
            console.log("   Error:", errorText);
        }

    } catch (error) {
        console.error("❌ Test failed:", error.message);
        if (error.code) console.error("   Code:", error.code);
    } finally {
        process.exit();
    }
}

testLogin();
