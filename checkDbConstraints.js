import pool from "./src/config/db.js";

async function checkConstraints() {
    try {
        console.log("Checking constraints for print_job_drafts...");
        const res = await pool.query(`
            SELECT conname, pg_get_constraintdef(oid) as def
            FROM pg_constraint
            WHERE conrelid = 'print_jobs'::regclass
        `);

        console.log("Constraints Found:");
        res.rows.forEach(row => {
            console.log(`- ${row.conname}`);
            const def = row.def;
            for (let i = 0; i < def.length; i += 100) {
                console.log(def.substring(i, i + 100));
            }
        });

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await pool.end();
    }
}

checkConstraints();
