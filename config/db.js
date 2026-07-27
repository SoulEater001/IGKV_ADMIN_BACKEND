import mysql from "mysql2/promise";
import fs from "fs"
export const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    // ssl: {
    //     ca: fs.readFileSync("./globalsignrootca.pem")
    // },

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function test() {
    try {
        const [rows] = await pool.query("SELECT 1");
        console.log("Connected to MariaDB");
    } catch (err) {
        console.error(err);
    }
}

test();