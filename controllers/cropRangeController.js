import { pool } from "../config/db.js";
import { logActivity } from "../utils/activityLogger.js";
import { ACTIONS } from "../constant/activityActions.js";
import { ENTITIES } from "../constant/activityEntities.js";
import { requiresApproval } from "../utils/approval.js";
import {
    hasPendingApproval,
    createApprovalRequest
} from "../services/approvalService.js";
import { executeCreateCropRange, executeUpdateCropRange, executeDeactivateCropRange } from "../services/cropRangeService.js";

export const getCropRangesPaginated = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = "",
            status,
            crop_id,
            crop_stage_id,
            from_date,
            to_date
        } = req.query;

        const pageNumber = Number(page);
        const pageSize = Number(limit);
        const offset = (pageNumber - 1) * pageSize;

        let where = `WHERE 1 = 1`;
        const params = [];

        if (status !== undefined && status !== "") {
            where += ` AND cr.is_active = ?`;
            params.push(Number(status));
        }

        if (crop_id !== undefined && crop_id !== "") {
            where += ` AND cr.crop_id = ?`;
            params.push(Number(crop_id));
        }

        if (crop_stage_id !== undefined && crop_stage_id !== "") {
            where += ` AND cr.crop_stage_id = ?`;
            params.push(Number(crop_stage_id));
        }

        if (from_date !== undefined && from_date !== "") {
            where += ` AND cr.end_date >= ?`;
            params.push(from_date);
        }

        if (to_date !== undefined && to_date !== "") {
            where += ` AND cr.start_date <= ?`;
            params.push(to_date);
        }

        if (search.trim()) {
            where += `
                AND (
                    LOWER(c.imd_crop_name) LIKE LOWER(?)
                    OR LOWER(c.imd_crop_name_h) LIKE LOWER(?)
                    OR LOWER(cs.stage_name) LIKE LOWER(?)
                    OR LOWER(cs.stage_name_h) LIKE LOWER(?)
                    OR LOWER(cs.stage_code) LIKE LOWER(?)
                    OR LOWER(cr.description) LIKE LOWER(?)
                    OR CAST(cr.id AS CHAR) LIKE ?
                )
            `;

            const keyword = `%${search.trim()}%`;

            params.push(
                keyword,
                keyword,
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
            FROM crop_ranges cr
            INNER JOIN imd_m_crop c
                ON c.id = cr.crop_id
            INNER JOIN crop_stages cs
                ON cs.id = cr.crop_stage_id
            ${where}
            `,
            params
        );

        const [rows] = await pool.query(
            `
            SELECT
                cr.id,
                cr.crop_id,
                cr.crop_stage_id,
                c.imd_crop_name AS crop_name,
                c.imd_crop_name_h AS crop_name_h,
                cs.stage_name,
                cs.stage_name_h,
                cs.stage_code,
                DATE_FORMAT(cr.start_date, '%Y-%m-%d') AS start_date,
                DATE_FORMAT(cr.end_date, '%Y-%m-%d') AS end_date,
                cr.description,
                cr.is_active
            FROM crop_ranges cr
            INNER JOIN imd_m_crop c
                ON c.id = cr.crop_id
            INNER JOIN crop_stages cs
                ON cs.id = cr.crop_stage_id
            ${where}
            ORDER BY cr.id ASC
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
            totalPages: Math.ceil(
                countResult.total / pageSize
            ),
            data: rows
        });

    } catch (error) {

        console.error(
            "Error fetching crop ranges:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch crop ranges."
        });
    }
};

export const getCropRangeStages = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `
            SELECT
                id,
                stage_name,
                stage_name_h,
                stage_code,
                description,
                is_active
            FROM crop_stages
            WHERE is_active = 1
            ORDER BY id ASC
            `
        );

        return res.json({
            success: true,
            count: rows.length,
            data: rows
        });
    } catch (error) {
        console.error(
            "Error fetching crop stages:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch crop stages."
        });
    }
};

export const createCropRange = async (req, res) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const {
            crop_id,
            crop_stage_id,
            start_date,
            end_date,
            description,
            is_active = 1
        } = req.body;

        if (
            !crop_id ||
            !crop_stage_id ||
            !start_date ||
            !end_date
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Crop, crop stage, start date and end date are required."
            });
        }

        if (end_date < start_date) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "End date cannot be before start date."
            });
        }

        const [[crop]] = await connection.query(
            `
            SELECT
                id,
                imd_crop_name
            FROM imd_m_crop
            WHERE id = ?
            `,
            [crop_id]
        );

        if (!crop) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Crop not found."
            });
        }

        const [[stage]] = await connection.query(
            `
            SELECT
                id,
                stage_name
            FROM crop_stages
            WHERE id = ?
              AND is_active = 1
            `,
            [crop_stage_id]
        );

        if (!stage) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Active crop stage not found."
            });
        }

        const [[overlap]] = await connection.query(
            `
            SELECT id
            FROM crop_ranges
            WHERE crop_id = ?
              AND crop_stage_id = ?
              AND is_active = 1
              AND start_date <= ?
              AND end_date >= ?
            LIMIT 1
            `,
            [
                crop_id,
                crop_stage_id,
                end_date,
                start_date
            ]
        );

        if (overlap) {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message:
                    "An active range already exists for this crop and crop stage during the selected dates."
            });
        }

        const rangeData = {
            crop_id: Number(crop_id),
            crop_stage_id: Number(crop_stage_id),
            start_date,
            end_date,
            description: description?.trim() || null,
            is_active: is_active ? 1 : 0
        };

        if (await requiresApproval(connection, req.user.id)) {
            const pending = await hasPendingApproval(
                connection,
                ENTITIES.CROP_RANGE,
                ACTIONS.CREATE,
                {
                    crop_id: rangeData.crop_id,
                    crop_stage_id: rangeData.crop_stage_id
                }
            );

            if (pending) {
                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message:
                        "A crop range creation request is already pending."
                });
            }

            await createApprovalRequest(
                connection,
                {
                    resource: ENTITIES.CROP_RANGE,
                    action: ACTIONS.CREATE,
                    payload: rangeData,
                    requestedBy: req.user.id
                }
            );

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.CREATE,
                entity: ENTITIES.CROP_RANGE,
                entityId: req.user.id,
                description:
                    `${req.user.name} requested creation of crop range for ${crop.imd_crop_name} - ${stage.stage_name}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message:
                    "Crop range creation request sent for approval."
            });
        }

        const rangeId = await executeCreateCropRange(
            connection,
            rangeData
        );

        await connection.commit();

        await logActivity({
            userId: req.user.id,
            action: ACTIONS.CREATE,
            entity: ENTITIES.CROP_RANGE,
            entityId: rangeId,
            description:
                `${req.user.name} created crop range for ${crop.imd_crop_name} - ${stage.stage_name}`,
            ipAddress: req.ip
        });

        return res.status(201).json({
            success: true,
            message: "Crop range created successfully.",
            data: {
                id: rangeId
            }
        });
    } catch (error) {
        console.error(error);

        await connection.rollback();

        return res.status(500).json({
            success: false,
            message:
                "Failed to create crop range."
        });
    } finally {
        connection.release();
    }
};

export const updateCropRange = async (req, res) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { id } = req.params;

        const {
            crop_id,
            crop_stage_id,
            start_date,
            end_date,
            description,
            is_active
        } = req.body;

        if (
            !crop_id ||
            !crop_stage_id ||
            !start_date ||
            !end_date
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Crop, crop stage, start date and end date are required."
            });
        }

        if (end_date < start_date) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "End date cannot be before start date."
            });
        }

        const [[range]] = await connection.query(
            `
            SELECT
                id,
                crop_id,
                crop_stage_id
            FROM crop_ranges
            WHERE id = ?
            `,
            [id]
        );

        if (!range) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Crop range not found."
            });
        }

        const [[crop]] = await connection.query(
            `
            SELECT
                id,
                imd_crop_name
            FROM imd_m_crop
            WHERE id = ?
            `,
            [crop_id]
        );

        if (!crop) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Crop not found."
            });
        }

        const [[stage]] = await connection.query(
            `
            SELECT
                id,
                stage_name
            FROM crop_stages
            WHERE id = ?
            `,
            [crop_stage_id]
        );

        if (!stage) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Crop stage not found."
            });
        }

        if (Number(is_active) === 1) {
            const [[overlap]] = await connection.query(
                `
                SELECT id
                FROM crop_ranges
                WHERE crop_id = ?
                  AND crop_stage_id = ?
                  AND is_active = 1
                  AND id <> ?
                  AND start_date <= ?
                  AND end_date >= ?
                LIMIT 1
                `,
                [
                    crop_id,
                    crop_stage_id,
                    id,
                    end_date,
                    start_date
                ]
            );

            if (overlap) {
                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message:
                        "An active range already exists for this crop and crop stage during the selected dates."
                });
            }
        }

        const rangeData = {
            id: Number(id),
            crop_id: Number(crop_id),
            crop_stage_id: Number(crop_stage_id),
            start_date,
            end_date,
            description: description?.trim() || null,
            is_active: is_active ? 1 : 0
        };

        if (await requiresApproval(connection, req.user.id)) {
            const pending = await hasPendingApproval(
                connection,
                ENTITIES.CROP_RANGE,
                ACTIONS.UPDATE,
                {
                    id: Number(id)
                }
            );

            if (pending) {
                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message:
                        "A crop range update request is already pending."
                });
            }

            await createApprovalRequest(
                connection,
                {
                    resource: ENTITIES.CROP_RANGE,
                    action: ACTIONS.UPDATE,
                    recordId: Number(id),
                    payload: rangeData,
                    requestedBy: req.user.id
                }
            );

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.UPDATE,
                entity: ENTITIES.CROP_RANGE,
                entityId: Number(id),
                description:
                    `${req.user.name} requested update of crop range for ${crop.imd_crop_name} - ${stage.stage_name}`,
                ipAddress: req.ip
            });

            return res.status(202).json({
                success: true,
                approvalRequired: true,
                message:
                    "Crop range update submitted for approval."
            });
        }

        await executeUpdateCropRange(
            connection,
            rangeData
        );

        await connection.commit();

        await logActivity({
            userId: req.user.id,
            action: ACTIONS.UPDATE,
            entity: ENTITIES.CROP_RANGE,
            entityId: Number(id),
            description:
                `${req.user.name} updated crop range for ${crop.imd_crop_name} - ${stage.stage_name}`,
            ipAddress: req.ip
        });

        return res.status(200).json({
            success: true,
            message:
                "Crop range updated successfully."
        });
    } catch (error) {
        console.error(error);

        await connection.rollback();

        return res.status(500).json({
            success: false,
            message:
                error.message ||
                "Failed to update crop range."
        });
    } finally {
        connection.release();
    }
};

export const deleteCropRange = async (req, res) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { id } = req.params;

        const [[range]] = await connection.query(
            `
            SELECT
                cr.id,
                cr.crop_id,
                cr.crop_stage_id,
                cr.is_active,
                c.imd_crop_name AS crop_name,
                cs.stage_name
            FROM crop_ranges cr
            INNER JOIN imd_m_crop c
                ON c.id = cr.crop_id
            INNER JOIN crop_stages cs
                ON cs.id = cr.crop_stage_id
            WHERE cr.id = ?
            `,
            [id]
        );

        if (!range) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Crop range not found."
            });
        }

        if (!range.is_active) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Crop range is already inactive."
            });
        }

        const payload = {
            id: range.id,
            is_active: 0
        };

        if (await requiresApproval(connection, req.user.id)) {
            const pending = await hasPendingApproval(
                connection,
                ENTITIES.CROP_RANGE,
                ACTIONS.DELETE,
                {
                    id: range.id
                }
            );

            if (pending) {
                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message:
                        "A deactivate request for this crop range is already pending."
                });
            }

            await createApprovalRequest(
                connection,
                {
                    resource: ENTITIES.CROP_RANGE,
                    action: ACTIONS.DELETE,
                    recordId: range.id,
                    payload,
                    requestedBy: req.user.id
                }
            );

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.DELETE,
                entity: ENTITIES.CROP_RANGE,
                entityId: range.id,
                description:
                    `${req.user.name} requested deactivation of crop range for ${range.crop_name} - ${range.stage_name}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message:
                    "Crop range deactivation request sent for approval."
            });
        }

        await executeDeactivateCropRange(
            connection,
            range.id
        );

        await connection.commit();

        await logActivity({
            userId: req.user.id,
            action: ACTIONS.DELETE,
            entity: ENTITIES.CROP_RANGE,
            entityId: range.id,
            description:
                `${req.user.name} deactivated crop range for ${range.crop_name} - ${range.stage_name}`,
            ipAddress: req.ip
        });

        return res.status(200).json({
            success: true,
            message:
                "Crop range deactivated successfully."
        });
    } catch (error) {
        console.error(error);

        await connection.rollback();

        return res.status(500).json({
            success: false,
            message:
                "Failed to deactivate crop range."
        });
    } finally {
        connection.release();
    }
};