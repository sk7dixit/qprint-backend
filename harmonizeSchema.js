import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_RSZfQ57azcEK@ep-empty-star-a1so8gi5-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });

async function harmonize() {
    try {
        await client.connect();
        console.log("Connected to database. Harmonizing schema...");

        // Rename university_id to enrollment_id if it exists
        await client.query("ALTER TABLE users RENAME COLUMN university_id TO enrollment_id").catch(e => console.log("university_id already renamed or missing."));

        // Add is_profile_complete
        await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_profile_complete BOOLEAN DEFAULT FALSE");

        // Add shop_id (requires shops table first)
        await client.query(`
            CREATE TABLE IF NOT EXISTS shops (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                location VARCHAR(255),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS shop_id INTEGER REFERENCES shops(id)");

        console.log("✅ Schema harmonization complete.");
    } catch (e) {
        console.error("❌ Harmonization failed:", e.message);
    } finally {
        await client.end();
    }
}
harmonize();
