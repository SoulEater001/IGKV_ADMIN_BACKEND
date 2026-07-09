import {pool} from "../config/db.js"

export const getStates = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                state_id,
                name,
                state_lg_code,
                create_datetime
            FROM m_state
            WHERE deleted IS NULL
            ORDER BY name ASC
        `);

        return res.status(200).json({
            success: true,
            data: rows,
            count:rows.length
        });
    } catch (error) {
        console.error("Error fetching states:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch states.",
        });
    }
};