import { pool } from "../config/db.js";

export const getRoles = async (req, res) => {
    try {

        const [rows] = await pool.query(`
            SELECT
                id,
                name,
                description
            FROM roles
            ORDER BY name ASC
        `);

        return res.status(200).json({
            success: true,
            data: rows,
            count: rows.length
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch roles."
        });

    }
};