
import pool from "./src/config/db.js";

const checkUser = async () => {
    try {
        const res = await pool.query("SELECT * FROM users WHERE email = $1", ["shashwatdixit33@gmail.com"]);
        if (res.rows.length > 0) {
            console.log("USER_EXISTS:", JSON.stringify(res.rows[0]));
        } else {
            console.log("USER_NOT_FOUND");
        }
    } catch (err) {
        console.error("ERROR:", err);
    } finally {
        await pool.end();
    }
};

checkUser();
