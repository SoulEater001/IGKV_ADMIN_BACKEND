import { pool } from "../config/db.js";
import { logActivity } from '../utils/activityLogger.js'
import { ACTIONS } from "../constant/activityActions.js";
import { ENTITIES } from "../constant/activityEntities.js";

export const getCrops = async (req, res) => {
    try {
        const { page, limit = 10 } = req.query;

        const pageNumber = Number(page);
        const pageSize = Number(limit);
        const offset = (pageNumber - 1) * pageSize;

        const [[countResult]] = await pool.query(
            `
            SELECT COUNT(*) AS total
            FROM imd_m_crop
            `
        );

        // Fetch paginated crops
        const [rows] = await pool.query(
            `
            SELECT
                c.id,
                c.imd_crop_id,
                c.imd_crop_name,
                c.imd_crop_name_h,
                c.imd_category_id,
                mc.img_category_name AS category_name

            FROM imd_m_crop c

            LEFT JOIN imd_m_category mc
                ON c.imd_category_id = mc.imd_category_id

            ORDER BY c.id ASC

            LIMIT ?
            OFFSET ?
            `,
            [
                pageSize,
                offset
            ]
        );

        return res.json({
            success: true,
            page: pageNumber,
            limit: pageSize,
            total: countResult.total,
            totalPages: Math.ceil(countResult.total / pageSize),
            data: rows,
        });

    } catch (error) {

        console.error("Error fetching crops:", error);

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

        await logActivity({
            userId: req.user.id,
            action: ACTIONS.CREATE,
            entity: ENTITIES.CROP,
            entityId: cropId,
            description: `${req.user.name} created crop ${imd_crop_name.trim()}`,
            ipAddress: req.ip
        });

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
            SELECT id, imd_crop_name
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

        await logActivity({
            userId: req.user.id,
            action: ACTIONS.UPDATE,
            entity: ENTITIES.CROP,
            entityId: id,
            description: `${req.user.name} updated crop ${imd_crop_name.trim()}`,
            ipAddress: req.ip
        });

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

        const [[crop]] = await pool.query(
            `
                SELECT
                    id,
                    imd_crop_name
                FROM imd_m_crop
                WHERE id = ?
            `,
            [id]
        );

        if (!crop) {
            return res.status(404).json({
                success: false,
                message: "Crop not found."
            });
        }

        /*const [[usage]] = await pool.query(
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
        }*/

        await pool.query(
            `
            DELETE FROM imd_m_crop
            WHERE id = ?
            `,
            [id]
        );

        await logActivity({
            userId: req.user.id,
            action: ACTIONS.DELETE,
            entity: ENTITIES.CROP,
            entityId: id,
            description: `${req.user.name} deleted crop ${crop.imd_crop_name}`,
            ipAddress: req.ip
        });

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