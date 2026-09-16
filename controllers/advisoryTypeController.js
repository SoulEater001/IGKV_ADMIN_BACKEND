import { pool } from "../config/db.js";
import { ACTIONS } from "../constant/activityActions.js";
import { ENTITIES } from "../constant/activityEntities.js";
import { logActivity } from '../utils/activityLogger.js'
import { hasPendingApproval, createApprovalRequest } from '../services/approvalService.js'
import { requiresApproval } from '../utils/approval.js'
import { executeCreateAdvisoryType, executeDeleteAdvisoryType, executeUpdateAdvisoryType } from "../services/advisoryService.js";

export const getAdvisoryTypes = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                id,
                imd_advisory_type_id,
                imd_advisory_type_name,
                imd_advisory_type_name_h
            FROM imd_advisory_type
            ORDER BY id ASC
        `);

        res.json({
            success: true,
            data: rows,
            count: rows.length
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch advisory types."
        });

    }
};

export const createAdvisoryType = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const {
            imd_advisory_type_name,
            imd_advisory_type_name_h
        } = req.body;

        if (!imd_advisory_type_name?.trim() || !imd_advisory_type_name_h.trim()) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: "Advisory type name is required."
            });
        }

        const advisoryTypeData = {
            imd_advisory_type_name: imd_advisory_type_name.trim(),
            imd_advisory_type_name_h:
                imd_advisory_type_name_h?.trim() || null
        };

        const [[existing]] = await connection.query(
            `
            SELECT id
            FROM imd_advisory_type
            WHERE imd_advisory_type_name = ?
            `,
            [advisoryTypeData.imd_advisory_type_name]
        );

        if (existing) {

            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: "Advisory type already exists."
            });

        }

        if (await requiresApproval(connection, req.user.id)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.ADVISORY_TYPE,
                ACTIONS.CREATE,
                {
                    imd_advisory_type_name:
                        advisoryTypeData.imd_advisory_type_name
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "An advisory type creation request with this name is already pending."
                });

            }

            await createApprovalRequest(connection, {
                resource: ENTITIES.ADVISORY_TYPE,
                action: ACTIONS.CREATE,
                payload: advisoryTypeData,
                requestedBy: req.user.id
            });

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.CREATE,
                entity: ENTITIES.ADVISORY_TYPE,
                entityId: req.user.id,
                description: `${req.user.name} requested creation of advisory type ${advisoryTypeData.imd_advisory_type_name}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message: "Advisory type creation request sent for approval."
            });

        } else {
            const advisoryTypeId =
                await executeCreateAdvisoryType(
                    connection,
                    advisoryTypeData
                );

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.CREATE,
                entity: ENTITIES.ADVISORY_TYPE,
                entityId: advisoryTypeId,
                description: `${req.user.name} created advisory type ${imd_advisory_type_name.trim()}`,
                ipAddress: req.ip
            });

            return res.status(201).json({
                success: true,
                message: "Advisory type created successfully.",
                data: {
                    id: advisoryTypeId,
                    imd_advisory_type_id: advisoryTypeId
                }
            });
        }
    } catch (error) {

        console.error(error);
        await connection.rollback();
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to create advisory type."
        });

    } finally {
        connection.release();
    }
};

export const updateAdvisoryType = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;

        const {
            imd_advisory_type_name,
            imd_advisory_type_name_h
        } = req.body;

        if (!imd_advisory_type_name?.trim()) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: "Advisory type name is required."
            });
        }

        const [[advisoryType]] = await connection.query(
            `
            SELECT
                id,
                imd_advisory_type_name
            FROM imd_advisory_type
            WHERE id = ?
            `,
            [id]
        );

        if (!advisoryType) {

            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Advisory type not found."
            });

        }

        const [[existing]] = await connection.query(
            `
            SELECT id
            FROM imd_advisory_type
            WHERE LOWER(imd_advisory_type_name) = LOWER(?)
              AND id <> ?
            `,
            [
                imd_advisory_type_name.trim(),
                id
            ]
        );

        if (existing) {

            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: "Advisory type already exists."
            });

        }
        const advisoryTypeData = {

            id: Number(id),

            imd_advisory_type_name:
                imd_advisory_type_name.trim(),

            imd_advisory_type_name_h:
                imd_advisory_type_name_h?.trim() || null

        };

        if (await requiresApproval(connection, req.user.id)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.ADVISORY_TYPE,
                ACTIONS.UPDATE,
                {
                    id: Number(id)
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "An advisory type update request is already pending."
                });

            }

            await createApprovalRequest(
                connection,
                {
                    resource: ENTITIES.ADVISORY_TYPE,
                    action: ACTIONS.UPDATE,
                    recordId: Number(id),
                    payload: advisoryTypeData,
                    requestedBy: req.user.id
                }
            );

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.UPDATE,
                entity: ENTITIES.ADVISORY_TYPE,
                entityId: Number(id),
                description: `${req.user.name} requested update of advisory type ${imd_advisory_type_name.trim()}`,
                ipAddress: req.ip
            });

            return res.status(202).json({
                success: true,
                approvalRequired: true,
                message: "Advisory type update submitted for approval."
            });

        } else {
            await executeUpdateAdvisoryType(
                connection,
                advisoryTypeData
            );

            await connection.commit();
            await logActivity({
                userId: req.user.id,
                action: ENTITIES.UPDATE,
                entity: ENTITIES.ADVISORY_TYPE,
                entityId: Number(id),
                description: `${req.user.name} updated advisory type ${imd_advisory_type_name.trim()}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                message: "Advisory type updated successfully."
            });
        }
    } catch (error) {
        await connection.rollback();
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to update advisory type."
        });

    } finally { connection.release(); }
};

export const deleteAdvisoryType = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;

        // Check if advisory type exists
        const [[advisoryType]] = await connection.query(
            `
            SELECT id, imd_advisory_type_name
            FROM imd_advisory_type
            WHERE id = ?
            `,
            [id]
        );

        if (!advisoryType) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: "Advisory type not found."
            });
        }

        // Check if it is being used
        const [[usage]] = await connection.query(
            `
            SELECT COUNT(*) AS total
            FROM imd_advisory_detail
            WHERE advisory_type_id = ?
            `,
            [id]
        );

        if (usage.total > 0) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: "Cannot delete advisory type because it is used by existing advisories."
            });
        }

        const payload = {
            id: advisoryType.id,
            imd_advisory_type_name: advisoryType.imd_advisory_type_name
        };

        if (await requiresApproval(connection, req.user.id)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.ADVISORY_TYPE,
                ACTIONS.DELETE,
                {
                    id: advisoryType.id
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "A delete request for this advisory type is already pending."
                });

            }

            await createApprovalRequest(connection, {
                resource: ENTITIES.ADVISORY_TYPE,
                action: ACTIONS.DELETE,
                recordId: advisoryType.id,
                payload,
                requestedBy: req.user.id
            });

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.DELETE,
                entity: ENTITIES.ADVISORY_TYPE,
                entityId: advisoryType.id,
                description: `${req.user.name} requested deletion of advisory type ${advisoryType.imd_advisory_type_name}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message: "Advisory type deletion request sent for approval."
            });

        } else {
            const advisoryTypeId = await executeDeleteAdvisoryType(
                connection,
                advisoryType.id
            );

            await connection.commit();
            await logActivity({
                userId: req.user.id,
                action: ACTIONS.DELETE,
                entity: ENTITIES.ADVISORY_TYPE,
                entityId: advisoryTypeId,
                description: `${req.user.name} deleted advisory type ${advisoryType.imd_advisory_type_name}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                message: "Advisory type deleted successfully."
            });
        }
    } catch (error) {
        console.error(error);
        await connection.rollback();
        return res.status(500).json({
            success: false,
            message: "Failed to delete advisory type."
        });
    } finally {
        await connection.release();
    }
};


