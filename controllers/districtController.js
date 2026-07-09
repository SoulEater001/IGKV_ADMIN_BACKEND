import { pool } from "../config/db.js";

export const getDistrictsByZone = async (req, res) => {
    try {
        const { zoneId } = req.query;

        if (!zoneId) {
            return res.status(400).json({
                success: false,
                message: "zoneId is required.",
            });
        }

        const [rows] = await pool.query(
            `
            SELECT
                district_id,
                name,
                district_lg_code
            FROM m_district
            WHERE zone_id = ?
              AND deleted IS NULL
            ORDER BY name ASC
            `,
            [zoneId]
        );

        return res.status(200).json({
            success: true,
            count: rows.length,
            data: rows,
        });
    } catch (error) {
        console.error("Error fetching districts:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch districts.",
        });
    }
};