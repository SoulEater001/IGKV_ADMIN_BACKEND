import { pool } from "../config/db.js";
import { logActivity } from "../utils/activityLogger.js";
import { ACTIONS } from "../constant/activityActions.js";
import { ENTITIES } from "../constant/activityEntities.js";
import { requiresApproval } from "../utils/approval.js";
import {
    hasPendingApproval,
    createApprovalRequest
} from "../services/approvalService.js";
import {
    executeCreateCropStage,
    executeUpdateCropStage,
    executeDeactivateCropStage
} from "../services/cropStageService.js";

export const getCropStagesPaginated = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = "",
            status
        } = req.query;

        const pageNumber = Number(page);
        const pageSize = Number(limit);
        const offset = (pageNumber - 1) * pageSize;

        let where = `WHERE 1 = 1`;

        const params = [];

        if (status !== undefined && status !== "") {

            where += ` AND is_active = ?`;

            params.push(Number(status));

        }

        if (search.trim()) {

            where += `
                AND (
                    LOWER(stage_name) LIKE LOWER(?)
                    OR LOWER(stage_name_h) LIKE LOWER(?)
                    OR LOWER(stage_code) LIKE LOWER(?)
                    OR CAST(id AS CHAR) LIKE ?
                )
            `;

            const keyword = `%${search.trim()}%`;

            params.push(
                keyword,
                keyword,
                keyword,
                keyword
            );
        }

        const [[countResult]] = await pool.query(
            `
            SELECT COUNT(*) AS total

            FROM crop_stages

            ${where}
            `,
            params
        );

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

            ${where}

            ORDER BY id ASC

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
            "Error fetching crop stages:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch crop stages."
        });

    }
};


export const getCropStages = async (req, res) => {
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


export const createCropStage = async (req, res) => {

    const connection = await pool.getConnection();

    try {

        await connection.beginTransaction();

        const {
            stage_name,
            stage_name_h,
            stage_code,
            description,
            is_active = 1
        } = req.body;


        if (
            !stage_name?.trim() ||
            !stage_name_h?.trim()
        ) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Stage name and Hindi stage name are required."
            });

        }


        const stageData = {

            stage_name:
                stage_name.trim(),

            stage_name_h:
                stage_name_h.trim(),

            stage_code:
                stage_code?.trim() || null,

            description:
                description?.trim() || null,

            is_active:
                is_active ? 1 : 0

        };


        const [[existing]] =
            await connection.query(
                `
                SELECT id

                FROM crop_stages

                WHERE
                    LOWER(stage_name) = LOWER(?)
                    OR (
                        stage_code IS NOT NULL
                        AND stage_code = ?
                    )

                LIMIT 1
                `,
                [
                    stageData.stage_name,
                    stageData.stage_code
                ]
            );


        if (existing) {

            await connection.rollback();

            return res.status(409).json({
                success: false,
                message:
                    "Crop stage or stage code already exists."
            });

        }


        if (requiresApproval(req.user)) {

            const pending =
                await hasPendingApproval(
                    connection,
                    ENTITIES.CROP_STAGE,
                    ACTIONS.CREATE,
                    {
                        stage_name:
                            stageData.stage_name
                    }
                );


            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message:
                        "A crop stage creation request with this name is already pending."
                });

            }


            await createApprovalRequest(
                connection,
                {
                    resource:
                        ENTITIES.CROP_STAGE,

                    action:
                        ACTIONS.CREATE,

                    payload:
                        stageData,

                    requestedBy:
                        req.user.id
                }
            );


            await connection.commit();


            await logActivity({
                userId: req.user.id,
                action: ACTIONS.CREATE,
                entity: ENTITIES.CROP_STAGE,
                entityId: req.user.id,
                description:
                    `${req.user.name} requested creation of crop stage ${stageData.stage_name}`,
                ipAddress: req.ip
            });


            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message:
                    "Crop stage creation request sent for approval."
            });

        }


        const stageId = await executeCreateCropStage(
            connection,
            stageData
        );


        await connection.commit();


        await logActivity({
            userId: req.user.id,
            action: ACTIONS.CREATE,
            entity: ENTITIES.CROP_STAGE,
            entityId: stageId,
            description:
                `${req.user.name} created crop stage ${stageData.stage_name}`,
            ipAddress: req.ip
        });


        return res.status(201).json({
            success: true,
            message:
                "Crop stage created successfully.",
            data: {
                id: stageId
            }
        });


    } catch (error) {

        console.error(error);

        await connection.rollback();

        return res.status(500).json({
            success: false,
            message:
                "Failed to create crop stage."
        });

    } finally {

        connection.release();

    }

};


export const updateCropStage = async (req, res) => {

    const connection = await pool.getConnection();

    try {

        await connection.beginTransaction();

        const { id } = req.params;

        const {
            stage_name,
            stage_name_h,
            stage_code,
            description,
            is_active
        } = req.body;


        if (!stage_name?.trim()) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Stage name is required."
            });

        }


        const [[stage]] =
            await connection.query(
                `
                SELECT
                    id,
                    stage_name,
                    stage_code

                FROM crop_stages

                WHERE id = ?
                `,
                [id]
            );


        if (!stage) {

            await connection.rollback();

            return res.status(404).json({
                success: false,
                message:
                    "Crop stage not found."
            });

        }


        const [[existing]] =
            await connection.query(
                `
                SELECT id

                FROM crop_stages

                WHERE
                    id <> ?

                    AND (
                        LOWER(stage_name) = LOWER(?)

                        OR (
                            stage_code IS NOT NULL
                            AND stage_code = ?
                        )
                    )

                LIMIT 1
                `,
                [
                    id,
                    stage_name.trim(),
                    stage_code?.trim() || null
                ]
            );


        if (existing) {

            await connection.rollback();

            return res.status(409).json({
                success: false,
                message:
                    "Crop stage or stage code already exists."
            });

        }


        const stageData = {

            id: Number(id),

            stage_name:
                stage_name.trim(),

            stage_name_h:
                stage_name_h?.trim() || null,

            stage_code:
                stage_code?.trim() || null,

            description:
                description?.trim() || null,

            is_active:
                is_active ? 1 : 0

        };


        if (requiresApproval(req.user)) {

            const pending =
                await hasPendingApproval(
                    connection,
                    ENTITIES.CROP_STAGE,
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
                        "A crop stage update request is already pending."
                });

            }


            await createApprovalRequest(
                connection,
                {
                    resource:
                        ENTITIES.CROP_STAGE,

                    action:
                        ACTIONS.UPDATE,

                    recordId:
                        Number(id),

                    payload:
                        stageData,

                    requestedBy:
                        req.user.id
                }
            );


            await connection.commit();


            await logActivity({
                userId: req.user.id,
                action: ACTIONS.UPDATE,
                entity: ENTITIES.CROP_STAGE,
                entityId: Number(id),
                description:
                    `${req.user.name} requested update of crop stage ${stageData.stage_name}`,
                ipAddress: req.ip
            });


            return res.status(202).json({
                success: true,
                approvalRequired: true,
                message:
                    "Crop stage update submitted for approval."
            });

        }


        await executeUpdateCropStage(
            connection,
            stageData
        );


        await connection.commit();


        await logActivity({
            userId: req.user.id,
            action: ACTIONS.UPDATE,
            entity: ENTITIES.CROP_STAGE,
            entityId: Number(id),
            description:
                `${req.user.name} updated crop stage ${stageData.stage_name}`,
            ipAddress: req.ip
        });


        return res.status(200).json({
            success: true,
            message:
                "Crop stage updated successfully."
        });


    } catch (error) {

        console.error(error);

        await connection.rollback();

        return res.status(500).json({
            success: false,
            message:
                error.message ||
                "Failed to update crop stage."
        });

    } finally {

        connection.release();

    }

};


export const deleteCropStage = async (req, res) => {

    const connection = await pool.getConnection();

    try {

        await connection.beginTransaction();

        const { id } = req.params;

        const [[stage]] =
            await connection.query(
                `
                SELECT
                    id,
                    stage_name,
                    is_active

                FROM crop_stages

                WHERE id = ?
                `,
                [id]
            );

        if (!stage) {

            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Crop stage not found."
            });

        }

        if (!stage.is_active) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Crop stage is already inactive."
            });

        }

        const payload = {

            id: stage.id,

            stage_name: stage.stage_name,

            is_active: 0

        };

        if (requiresApproval(req.user)) {

            const pending =
                await hasPendingApproval(
                    connection,
                    ENTITIES.CROP_STAGE,
                    ACTIONS.DELETE,
                    {
                        id: stage.id
                    }
                );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message:
                        "A deactivate request for this crop stage is already pending."
                });

            }

            await createApprovalRequest(
                connection,
                {
                    resource: ENTITIES.CROP_STAGE,

                    action: ACTIONS.DELETE,

                    recordId: stage.id,

                    payload,

                    requestedBy: req.user.id
                }
            );

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.DELETE,
                entity: ENTITIES.CROP_STAGE,
                entityId: stage.id,
                description:
                    `${req.user.name} requested deactivation of crop stage ${stage.stage_name}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message:
                    "Crop stage deactivation request sent for approval."
            });

        }

        await executeDeactivateCropStage(
            connection,
            stage.id
        );

        await connection.commit();

        await logActivity({
            userId: req.user.id,
            action: ACTIONS.DELETE,
            entity: ENTITIES.CROP_STAGE,
            entityId: stage.id,
            description:
                `${req.user.name} deactivated crop stage ${stage.stage_name}`,
            ipAddress: req.ip
        });

        return res.status(200).json({
            success: true,
            message:
                "Crop stage deactivated successfully."
        });

    } catch (error) {

        console.error(error);

        await connection.rollback();

        return res.status(500).json({
            success: false,
            message:
                "Failed to deactivate crop stage."
        });

    } finally {

        connection.release();

    }

};