import pool from '../src/config/db.js';

const listConstraints = async () => {
    try {
        const res = await pool.query(`
            SELECT 
                tc.table_name, 
                tc.constraint_name, 
                tc.constraint_type,
                cc.check_clause
            FROM 
                information_schema.table_constraints tc
                JOIN information_schema.check_constraints cc 
                  ON tc.constraint_name = cc.constraint_name
            WHERE 
                tc.table_name IN ('print_jobs', 'print_job_drafts')
        `);
        console.log("📜 Constraints found:");
        res.rows.forEach(row => {
            console.log(`- Table: ${row.table_name} | Name: ${row.constraint_name} | Clause: ${row.check_clause}`);
        });
        process.exit(0);
    } catch (error) {
        console.error("❌ Failed to list constraints:", error);
        process.exit(1);
    }
};

listConstraints();
