import { pool } from "../config/db.js";

export const getZones = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                Zone_id,
                name,
                Image_Path,
                create_datetime
            FROM m_zone
            WHERE deleted IS NULL
            ORDER BY name ASC
        `);

        res.json({
            success: true,
            count: rows.length,
            data: rows,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch zones.",
        });
    }
};

export const getZoneById = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await pool.query(
            `
            SELECT *
            FROM m_zone
            WHERE Zone_id = ?
            AND deleted IS NULL
            `,
            [id]
        );

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message: "Zone not found.",
            });
        }

        res.json({
            success: true,
            data: rows[0],
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch zone.",
        });
    }
};

export const createZone = async (req, res) => {
    try {

        const {
            name,
            imagePath = null
        } = req.body;

        if (!name?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Zone name is required."
            });
        }

        const [[existing]] = await pool.query(
            `
            SELECT Zone_id
            FROM m_zone
            WHERE LOWER(name) = LOWER(?)
              AND (deleted = 0 OR deleted IS NULL)
            `,
            [name.trim()]
        );

        if (existing) {
            return res.status(409).json({
                success: false,
                message: "Zone already exists."
            });
        }

        await pool.query(
            `
            INSERT INTO m_zone
            (
                name,
                Image_Path
            )
            VALUES (?, ?)
            `,
            [
                name.trim(),
                imagePath
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Zone created successfully."
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to create zone."
        });

    }
};

export const updateZone = async (req, res) => {
    try {

        const { id } = req.params;

        const {
            name,
            imagePath = null
        } = req.body;

        if (!name?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Zone name is required."
            });
        }

        const [[zone]] = await pool.query(
            `
            SELECT Zone_id
            FROM m_zone
            WHERE Zone_id = ?
            `,
            [id]
        );

        if (!zone) {
            return res.status(404).json({
                success: false,
                message: "Zone not found."
            });
        }

        const [[existing]] = await pool.query(
            `
            SELECT Zone_id
            FROM m_zone
            WHERE LOWER(name) = LOWER(?)
              AND Zone_id <> ?
              AND (deleted = 0 OR deleted IS NULL)
            `,
            [
                name.trim(),
                id
            ]
        );

        if (existing) {
            return res.status(409).json({
                success: false,
                message: "Zone already exists."
            });
        }

        await pool.query(
            `
            UPDATE m_zone
            SET
                name = ?,
                Image_Path = ?
            WHERE Zone_id = ?
            `,
            [
                name.trim(),
                imagePath,
                id
            ]
        );

        return res.status(200).json({
            success: true,
            message: "Zone updated successfully."
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to update zone."
        });

    }
};

export const deleteZone = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if zone has districts
        const [districts] = await pool.query(
            `
            SELECT COUNT(*) AS total
            FROM m_district
            WHERE Zone_id = ?
            AND deleted IS NULL
            `,
            [id]
        );

        if (districts[0].total > 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete zone because it contains districts.",
            });
        }

        const [result] = await pool.query(
            `
            UPDATE m_zone
            SET
                deleted = 'Y',
                delete_datetime = NOW()
            WHERE Zone_id = ?
            AND deleted IS NULL
            `,
            [id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                success: false,
                message: "Zone not found.",
            });
        }

        res.json({
            success: true,
            message: "Zone deleted successfully.",
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to delete zone.",
        });
    }
};