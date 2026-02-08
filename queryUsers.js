import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_RSZfQ57azcEK@ep-empty-star-a1so8gi5-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' });
client.connect()
    .then(() => client.query("SELECT * FROM users WHERE role = 'admin'"))
    .then(res => {
        console.log(JSON.stringify(res.rows, null, 2));
        client.end();
    })
    .catch(e => {
        console.error(e);
        client.end();
        process.exit(1);
    });
