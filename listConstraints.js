import pool from "./src/config/db.js";

async function listConstraints() {
    try {
        console.log("Listing constraints for print_jobs...");
        const res = await pool.query(`
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = 'print_jobs'::regclass
        `);

        console.log("Constraints Found:");
        res.rows.forEach(row => {
            console.log(`- ${row.conname}`);
        });

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await pool.end();
    }
}

listConstraints();
