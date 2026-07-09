import { pool } from "../config/db.js";

export const getCrops = async (req, res) => {
    try {

        const [rows] = await pool.query(`
            SELECT
                id,
                imd_crop_id,
                imd_crop_name,
                imd_crop_name_h,
                imd_category_id
            FROM imd_m_crop
            ORDER BY imd_crop_name ASC
        `);

        return res.json({
            success: true,
            data: rows,
            count: rows.length
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch crops."
        });

    }
};

export const createCrop = async (req, res) => {
    try {

        const {
            imd_crop_name,
            imd_crop_name_h,
            imd_category_id
        } = req.body;

        if (!imd_crop_name?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Crop name is required."
            });
        }

        const [result] = await pool.query(
            `
            INSERT INTO imd_m_crop
            (
                imd_crop_name,
                imd_crop_name_h,
                imd_category_id
            )
            VALUES (?, ?, ?)
            `,
            [
                imd_crop_name.trim(),
                imd_crop_name_h?.trim() || null,
                imd_category_id || null
            ]
        );

        const cropId = result.insertId;

        await pool.query(
            `
            UPDATE imd_m_crop
            SET imd_crop_id = ?
            WHERE id = ?
            `,
            [cropId, cropId]
        );

        return res.status(201).json({
            success: true,
            message: "Crop created successfully.",
            data: {
                id: cropId,
                imd_crop_id: cropId
            }
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to create crop."
        });

    }
};

export const updateCrop = async (req, res) => {
    try {

        const { id } = req.params;

        const {
            imd_crop_name,
            imd_crop_name_h,
            imd_category_id
        } = req.body;

        if (!imd_crop_name?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Crop name is required."
            });
        }

        const [rows] = await pool.query(
            `
            SELECT id
            FROM imd_m_crop
            WHERE id = ?
            `,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Crop not found."
            });
        }

        await pool.query(
            `
            UPDATE imd_m_crop
            SET
                imd_crop_name = ?,
                imd_crop_name_h = ?,
                imd_category_id = ?
            WHERE id = ?
            `,
            [
                imd_crop_name.trim(),
                imd_crop_name_h?.trim() || null,
                imd_category_id || null,
                id
            ]
        );

        return res.status(200).json({
            success: true,
            message: "Crop updated successfully."
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to update crop."
        });

    }
};

export const deleteCrop = async (req, res) => {
    try {

        const { id } = req.params;

        const [rows] = await pool.query(
            `
            SELECT id
            FROM imd_m_crop
            WHERE id = ?
            `,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Crop not found."
            });
        }

        {/*const [[usage]] = await pool.query(
            `
                SELECT COUNT(*) AS total
                FROM some_table
                WHERE crop_id = ?
            `,
            [id]
        );

        if (usage.total > 0) {
            return res.status(409).json({
                success: false,
                message: "Cannot delete crop because it is used by existing records."
            });
        }*/}

        await pool.query(
            `
            DELETE FROM imd_m_crop
            WHERE id = ?
            `,
            [id]
        );

        return res.status(200).json({
            success: true,
            message: "Crop deleted successfully."
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete crop."
        });

    }
};