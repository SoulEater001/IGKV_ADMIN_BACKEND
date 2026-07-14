import { pool } from "../config/db.js";
import { PERMISSION_ACTIONS, PERMISSION_RESOURCES } from "../constant/index.js";
import { logActivity } from '../utils/activityLogger.js'
import { ACTIONS } from "../constant/activityActions.js";
import { ENTITIES } from "../constant/activityEntities.js";
import { executeCreatePermission, executeDeletePermission } from "../services/permissionService.js";
import { ROLES } from "../constant/index.js";
import { hasPendingApproval, createApprovalRequest } from '../services/approvalService.js'

export const getPermissions = async (req, res) => {
    try {

        const [rows] = await pool.query(`
            SELECT
                id,
                resource,
                action
            FROM permissions
            ORDER BY resource ASC, action ASC
        `);

        return res.status(200).json({
            success: true,
            data: rows,
            count: rows.length
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch permissions."
        });

    }
};

export const createPermission = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const {
            resource,
            action
        } = req.body;

        if (
            !resource?.trim() ||
            !action?.trim()
        ) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: "Resource and action are required."
            });
        }

        const [[existing]] = await connection.query(
            `
            SELECT id
            FROM permissions
            WHERE resource = ?
              AND action = ?
            `,
            [
                resource.trim(),
                action.trim()
            ]
        );

        if (existing) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: "Permission already exists."
            });
        }

        const permissionData = {
            resource: resource.trim(),
            action: action.trim(),
        };

        if (requiresApproval(req.user)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.PERMISSION,
                ACTIONS.CREATE,
                {
                    resource: resource.trim(),
                    action: action.trim()
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "A permission creation request for this resource is already pending."
                });

            }

            await createApprovalRequest(connection, {
                resource: ENTITIES.PERMISSION,
                action: ACTIONS.CREATE,
                payload: permissionData,
                requestedBy: req.user.id
            });

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.CREATE,
                entity: ENTITIES.PERMISSION,
                entityId: req.user.id,
                description: `${req.user.name} requested creation of permission ${permissionData.resource}:${permissionData.action}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message: "Permission creation request sent for approval."
            });

        } else {
            const permissionId = await executeCreatePermission(
                connection,
                permissionData
            );

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.CREATE,
                entity: ENTITIES.PERMISSION,
                entityId: permissionId,
                description: `${req.user.name} created permission ${resource.trim()}:${action.trim()}`,
                ipAddress: req.ip
            });

            return res.status(201).json({
                success: true,
                message: "Permission created successfully."
            });
        }
    } catch (error) {

        console.error(error);
        await connection.rollback();
        return res.status(500).json({
            success: false,
            message: "Failed to create permission."
        });

    } finally {
        connection.release();
    }
};

export const updatePermission = async (req, res) => {
    try {

        const { id } = req.params;

        const {
            resource,
            action
        } = req.body;

        if (
            !resource?.trim() ||
            !action?.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Resource and action are required."
            });
        }

        const [[permission]] = await pool.query(
            `
            SELECT id, resource,
            action
            FROM permissions
            WHERE id = ?
            `,
            [id]
        );

        if (!permission) {
            return res.status(404).json({
                success: false,
                message: "Permission not found."
            });
        }

        const [[existing]] = await pool.query(
            `
            SELECT id
            FROM permissions
            WHERE resource = ?
              AND action = ?
              AND id <> ?
            `,
            [
                resource.trim(),
                action.trim(),
                id
            ]
        );

        if (existing) {
            return res.status(409).json({
                success: false,
                message: "Permission already exists."
            });
        }

        await pool.query(
            `
            UPDATE permissions
            SET
                resource = ?,
                action = ?
            WHERE id = ?
            `,
            [
                resource.trim(),
                action.trim(),
                id
            ]
        );

        await logActivity({
            userId: req.user.id,
            action: ACTIONS.UPDATE,
            entity: ENTITIES.PERMISSION,
            entityId: id,
            description: `${req.user.name} updated permission ${resource.trim()}:${action.trim()}`,
            ipAddress: req.ip
        });

        return res.status(200).json({
            success: true,
            message: "Permission updated successfully."
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to update permission."
        });

    }
};

export const deletePermission = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;

        const [[permission]] = await connection.query(
            `
            SELECT
                id,
                resource,
                action
            FROM permissions
            WHERE id = ?
            `,
            [id]
        );

        if (!permission) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: "Permission not found."
            });
        }
        const payload = {
            id: permission.id,
            resource: permission.resource,
            action: permission.action
        };

        if (requiresApproval(req.user)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.PERMISSION,
                ACTIONS.DELETE,
                {
                    id: permission.id
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "A delete request for this permission is already pending."
                });

            }

            await createApprovalRequest(connection, {
                resource: ENTITIES.PERMISSION,
                action: ACTIONS.DELETE,
                recordId: permission.id,
                payload,
                requestedBy: req.user.id
            });

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.DELETE,
                entity: ENTITIES.PERMISSION,
                entityId: permission.id,
                description: `${req.user.name} requested deletion of permission ${permission.resource}:${permission.action}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message: "Permission deletion request sent for approval."
            });

        } else {
            const permissionId = await executeDeletePermission(
                connection,
                permission.id
            );

            await connection.commit();


            await logActivity({
                userId: req.user.id,
                action: ACTIONS.DELETE,
                entity: ENTITIES.PERMISSION,
                entityId: permissionId,
                description: `${req.user.name} deleted permission ${permission.resource}:${permission.action}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                message: "Permission deleted successfully."
            });
        }
    } catch (error) {

        console.error(error);
        await connection.rollback();
        return res.status(500).json({
            success: false,
            message: "Failed to delete permission."
        });

    } finally { connection.release(); }

};

export const getPermissionOptions = async (req, res) => {

    return res.status(200).json({
        success: true,
        data: {
            resources: PERMISSION_RESOURCES,
            actions: PERMISSION_ACTIONS
        }
    });

};