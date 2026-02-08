import pool from "./src/config/db.js";

async function inspect() {
    try {
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public';
        `);
        console.log("Tables:", tables.rows.map(r => r.table_name));

        const columns = await pool.query(`
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            ORDER BY table_name, ordinal_position;
        `);
        console.log("Columns:");
        columns.rows.forEach(r => {
            console.log(`${r.table_name}.${r.column_name} (${r.data_type})`);
        });

        const usersCount = await pool.query("SELECT COUNT(*) FROM users");
        console.log("Users count:", usersCount.rows[0].count);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

inspect();
