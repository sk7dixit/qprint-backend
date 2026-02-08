import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_RSZfQ57azcEK@ep-empty-star-a1so8gi5-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });

async function debugAdmin() {
    try {
        await client.connect();

        console.log("=== CHECKING FOR ADMIN RECORDS ===\n");

        // Check by email
        const emailCheck = await client.query("SELECT * FROM users WHERE email = $1", ['qprint92@gmail.com']);
        console.log("Records with email 'qprint92@gmail.com':");
        console.log(JSON.stringify(emailCheck.rows, null, 2));

        console.log("\n=== ALL USERS WITH ADMIN ROLE ===\n");
        const adminCheck = await client.query("SELECT * FROM users WHERE role = 'admin'");
        console.log(JSON.stringify(adminCheck.rows, null, 2));

        console.log("\n=== ALL USERS (FULL TABLE) ===\n");
        const allUsers = await client.query("SELECT uid, email, name, role FROM users LIMIT 20");
        console.log(JSON.stringify(allUsers.rows, null, 2));

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await client.end();
    }
}

debugAdmin();
