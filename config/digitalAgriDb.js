import mysql from "mysql2/promise";

export const digitalAgriPool = mysql.createPool({
    host: process.env.DA_DB_HOST,
    port: process.env.DA_DB_PORT,
    user: process.env.DA_DB_USER,
    password: process.env.DA_DB_PASSWORD,
    database: process.env.DA_DB_NAME,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function test() {
    try {
        const [rows] = await digitalAgriPool.query("SELECT DATABASE() AS db");
        console.log(rows);
        await digitalAgriPool.query("SELECT 1");
        console.log("Connected to Digital Agri DB");
    } catch (err) {
        console.error("Digital Agri DB:", err);
    }
}

test();