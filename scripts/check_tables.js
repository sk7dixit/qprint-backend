import pool from '../src/config/db.js';

const checkTables = async () => {
    try {
        const res = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log("📊 Current Tables in 'public' schema:");
        res.rows.forEach(row => console.log(`- ${row.table_name}`));
        process.exit(0);
    } catch (error) {
        console.error("❌ Failed to check tables:", error);
        process.exit(1);
    }
};

checkTables();
