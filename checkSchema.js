import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_RSZfQ57azcEK@ep-empty-star-a1so8gi5-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });

async function verify() {
    try {
        await client.connect();
        const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
verify();
