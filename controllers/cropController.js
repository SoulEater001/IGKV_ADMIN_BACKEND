import { pool } from "../config/db.js";
import { logActivity } from '../utils/activityLogger.js'
import { ACTIONS } from "../constant/activityActions.js";
import { ENTITIES } from "../constant/activityEntities.js";
import { requiresApproval } from '../utils/approval.js'
import { hasPendingApproval, createApprovalRequest } from '../services/approvalService.js'
import { executeDeleteCrop, executeCreateCrop, executeUpdateCrop } from "../services/cropService.js";

export const getCropsPaginated = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = ""
        } = req.query;

        const pageNumber = Number(page);
        const pageSize = Number(limit);
        const offset = (pageNumber - 1) * pageSize;
        let where = `WHERE 1 = 1`;

        const params = [];

        if (search.trim()) {

            where += `
                AND (
                    LOWER(c.imd_crop_name) LIKE LOWER(?)
                    OR LOWER(c.imd_crop_name_h) LIKE LOWER(?)
                    OR LOWER(mc.img_category_name) LIKE LOWER(?)
                    OR CAST(c.id AS CHAR) LIKE ?
                    OR CAST(c.imd_crop_id AS CHAR) LIKE ?
                )
            `;

            const keyword = `%${search.trim()}%`;

            params.push(
                keyword,
                keyword,
                keyword,
                keyword,
                keyword
            );

        }

        const [[countResult]] = await pool.query(
            `
            SELECT COUNT(*) AS total

            FROM imd_m_crop c

            LEFT JOIN imd_m_category mc
                ON c.imd_category_id = mc.imd_category_id

            ${where}
            `,
            params
        );

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

            ${where}

            ORDER BY c.id ASC

            LIMIT ?

            OFFSET ?
            `,
            [
                ...params,
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
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const {
            imd_crop_name,
            imd_crop_name_h,
            imd_category_id
        } = req.body;

        if (!imd_crop_name?.trim() || !imd_crop_name_h?.trim() || !imd_category_id) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: "All fields are required."
            });
        }

        const cropData = {
            imd_crop_name: imd_crop_name.trim(),
            imd_crop_name_h: imd_crop_name_h?.trim(),
            imd_category_id: imd_category_id
        };

        const [[category]] = await connection.query(
            `
            SELECT id
            FROM imd_m_category
            WHERE id = ?
            `,
            [imd_category_id]
        );

        if (!category) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Category not found."
            });
        }

        if (requiresApproval(req.user)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.CROP,
                ACTIONS.CREATE,
                {
                    imd_crop_name: cropData.imd_crop_name
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "A crop creation request with this name is already pending."
                });

            }

            await createApprovalRequest(connection, {
                resource: ENTITIES.CROP,
                action: ACTIONS.CREATE,
                payload: cropData,
                requestedBy: req.user.id
            });

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.CREATE,
                entity: ENTITIES.CROP,
                entityId: req.user.id,
                description: `${req.user.name} requested creation of crop ${cropData.imd_crop_name}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message: "Crop creation request sent for approval."
            });

        } else {
            const cropId = await executeCreateCrop(
                connection,
                cropData
            );

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.CREATE,
                entity: ENTITIES.CROP,
                entityId: cropId,
                description: `${req.user.name} created crop ${cropData.imd_crop_name}`,
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
        }
    } catch (error) {

        console.error(error);
        await connection.rollback();
        return res.status(500).json({
            success: false,
            message: "Failed to create crop."
        });

    } finally {
        connection.release();
    }
};

export const updateCrop = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;

        const {
            imd_crop_name,
            imd_crop_name_h,
            imd_category_id
        } = req.body;

        if (!imd_crop_name?.trim()) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: "Crop name is required."
            });
        }

        const [[crop]] = await connection.query(
            `
            SELECT id, imd_crop_name
            FROM imd_m_crop
            WHERE id = ?
            `,
            [id]
        );

        if (!crop) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: "Crop not found."
            });
        }

        const [[existing]] = await connection.query(
            `
            SELECT id
            FROM imd_m_crop
            WHERE LOWER(imd_crop_name) = LOWER(?)
              AND id <> ?
            `,
            [
                imd_crop_name.trim(),
                id
            ]
        );

        if (existing) {

            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: "Crop already exists."
            });

        }

        const cropData = {

            id: Number(id),

            imd_crop_name: imd_crop_name.trim(),

            imd_crop_name_h:
                imd_crop_name_h?.trim() || null,

            imd_category_id:
                imd_category_id || null

        };

        if (requiresApproval(req.user)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.CROP,
                ACTIONS.UPDATE,
                {
                    id: Number(id)
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "A crop update request is already pending."
                });

            }

            await createApprovalRequest(
                connection,
                {
                    resource: ENTITIES.CROP,
                    action: ACTIONS.UPDATE,
                    recordId: Number(id),
                    payload: cropData,
                    requestedBy: req.user.id
                }
            );

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.UPDATE,
                entity: ENTITIES.CROP,
                entityId: Number(id),
                description: `${req.user.name} requested update of crop ${imd_crop_name.trim()}`,
                ipAddress: req.ip
            });

            return res.status(202).json({
                success: true,
                approvalRequired: true,
                message: "Crop update submitted for approval."
            });

        } else {
            executeUpdateCrop(connection, cropData);
            await connection.commit();

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
        }
    } catch (error) {
        await connection.rollback();
        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message || "Failed to update crop."
        });

    } finally {
        connection.release();
    }
};

export const deleteCrop = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { id } = req.params;

        const [[crop]] = await connection.query(
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
            await connection.rollback();
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

        const payload = {
            id: crop.id,
            imd_crop_name: crop.imd_crop_name
        };

        if (requiresApproval(req.user)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.CROP,
                ACTIONS.DELETE,
                {
                    id: crop.id
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "A delete request for this crop is already pending."
                });

            }

            await createApprovalRequest(connection, {
                resource: ENTITIES.CROP,
                action: ACTIONS.DELETE,
                recordId: crop.id,
                payload,
                requestedBy: req.user.id
            });

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.DELETE,
                entity: ENTITIES.CROP,
                entityId: crop.id,
                description: `${req.user.name} requested deletion of crop ${crop.imd_crop_name}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message: "Crop deletion request sent for approval."
            });

        } else {
            const cropId = await executeDeleteCrop(
                connection,
                crop.id
            );

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.DELETE,
                entity: ENTITIES.CROP,
                entityId: cropId,
                description: `${req.user.name} deleted crop ${crop.imd_crop_name}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                message: "Crop deleted successfully."
            });
        }
    } catch (error) {

        console.error(error);
        await connection.rollback();
        return res.status(500).json({
            success: false,
            message: "Failed to delete crop."
        });

    } finally {
        connection.release();
    }
};