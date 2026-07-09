import { pool } from "../config/db.js";

export const getCategories = async (req, res) => {
    try {

        const [rows] = await pool.query(`
            SELECT
                imd_category_id,
                img_category_name
            FROM imd_m_category
            ORDER BY img_category_name ASC
        `);

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch categories."
        });

    }
};