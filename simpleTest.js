// Simple direct fetch test
async function test() {
    try {
        console.log("Testing direct backend call...");
        const response = await fetch('http://localhost:5000/api/auth/profile/kxm2iOJGLuOQhkEFVCjJYIENp8F3', {
            headers: {
                'Authorization': 'Bearer test123',
                'Content-Type': 'application/json'
            }
        });

        console.log("Response:", response.status, await response.text());
    } catch (error) {
        console.error("Error:", error.message);
    }
}

test();
