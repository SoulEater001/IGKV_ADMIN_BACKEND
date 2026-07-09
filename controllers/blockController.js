import {pool} from "../config/db.js"

export const getBlocksByDistrict = async (req, res) => {
    try {
        const { districtId } = req.query;

        if (!districtId) {
            return res.status(400).json({
                success: false,
                message: "districtId is required."
            });
        }

        const [rows] = await pool.query(
            `
            SELECT
                block_id,
                name,
                block_lg_code
            FROM m_block
            WHERE district_id = ?
              AND deleted IS NULL
            ORDER BY name ASC
            `,
            [districtId]
        );

        return res.status(200).json({
            success: true,
            data: rows,
            count:rows.length
        });

    } catch (error) {
        console.error("Error fetching blocks:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch blocks.",
        });
    }
};