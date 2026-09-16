import { pool } from "../config/db.js";
import { PERMISSION_ACTION_LIST, PERMISSION_RESOURCE_LIST } from "../constant/index.js";
import { logActivity } from '../utils/activityLogger.js'
import { ACTIONS } from "../constant/activityActions.js";
import { ENTITIES } from "../constant/activityEntities.js";
import { executeCreatePermission, executeDeletePermission } from "../services/permissionService.js";
import { hasPendingApproval, createApprovalRequest } from '../services/approvalService.js'
import { requiresApproval } from "../utils/approval.js";

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

export const getPermissionsPaginated = async (req, res) => {
    try {

        const {
            page = 1,
            limit = 10,
            search = ""
        } = req.query;

        const pageNumber = Number(page);
        const pageSize = Number(limit);
        const offset = (pageNumber - 1) * pageSize;

        let where = "";
        const params = [];

        if (search.trim()) {

            where = `
                WHERE
                    LOWER(resource) LIKE LOWER(?)
                    OR LOWER(action) LIKE LOWER(?)
            `;

            const keyword = `%${search.trim()}%`;

            params.push(keyword, keyword);

        }

        const [[countResult]] = await pool.query(
            `
            SELECT COUNT(*) AS total
            FROM permissions
            ${where}
            `,
            params
        );

        const [rows] = await pool.query(
            `
            SELECT
                id,
                resource,
                action

            FROM permissions

            ${where}

            ORDER BY resource ASC, action ASC

            LIMIT ?
            OFFSET ?
            `,
            [
                ...params,
                pageSize,
                offset
            ]
        );

        return res.status(200).json({
            success: true,
            page: pageNumber,
            limit: pageSize,
            total: countResult.total,
            totalPages: Math.ceil(countResult.total / pageSize),
            data: rows
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

        const normalizedResource = resource.trim();
        const normalizedAction = action.trim();

        if (!PERMISSION_RESOURCE_LIST.includes(normalizedResource)) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Invalid permission resource."
            });
        }

        if (!PERMISSION_ACTION_LIST.includes(normalizedAction)) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Invalid permission action."
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
                normalizedResource,
                normalizedAction
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
            resource: normalizedResource,
            action: normalizedAction
        };

        if (await requiresApproval(connection, req.user.id)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.PERMISSION,
                ACTIONS.CREATE,
                {
                    resource: normalizedResource,
                    action: normalizedAction
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
                entityId: null,
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
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const permissionId = Number(req.params.id);

        if (!Number.isInteger(permissionId) || permissionId <= 0) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Invalid permission ID."
            });
        }

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

        const normalizedResource = resource.trim();
        const normalizedAction = action.trim();

        if (!PERMISSION_RESOURCE_LIST.includes(normalizedResource)) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Invalid permission resource."
            });
        }

        if (!PERMISSION_ACTION_LIST.includes(normalizedAction)) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Invalid permission action."
            });
        }

        const [[permission]] = await connection.query(
            `
            SELECT
                id,
                resource,
                action
            FROM permissions
            WHERE id = ?
            `,
            [permissionId]
        );

        if (!permission) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Permission not found."
            });
        }

        const [[existing]] = await connection.query(
            `
            SELECT id
            FROM permissions
            WHERE resource = ?
              AND action = ?
              AND id <> ?
            `,
            [
                normalizedResource,
                normalizedAction,
                permissionId
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
            id: permissionId,
            resource: normalizedResource,
            action: normalizedAction
        };

        if (await requiresApproval(connection, req.user.id)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.PERMISSION,
                ACTIONS.UPDATE,
                {
                    id: permissionId
                }
            );

            if (pending) {
                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "An update request for this permission is already pending."
                });
            }

            await createApprovalRequest(connection, {
                resource: ENTITIES.PERMISSION,
                action: ACTIONS.UPDATE,
                recordId: permissionId,
                payload: permissionData,
                requestedBy: req.user.id
            });

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.UPDATE,
                entity: ENTITIES.PERMISSION,
                entityId: permissionId,
                description: `${req.user.name} requested update of permission ${normalizedResource}:${normalizedAction}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message: "Permission update request sent for approval."
            });
        }

        await connection.query(
            `
            UPDATE permissions
            SET
                resource = ?,
                action = ?
            WHERE id = ?
            `,
            [
                normalizedResource,
                normalizedAction,
                permissionId
            ]
        );

        await connection.commit();

        await logActivity({
            userId: req.user.id,
            action: ACTIONS.UPDATE,
            entity: ENTITIES.PERMISSION,
            entityId: permissionId,
            description: `${req.user.name} updated permission ${normalizedResource}:${normalizedAction}`,
            ipAddress: req.ip
        });

        return res.status(200).json({
            success: true,
            message: "Permission updated successfully."
        });

    } catch (error) {
        await connection.rollback();

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to update permission."
        });

    } finally {
        connection.release();
    }
};

export const deletePermission = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const permissionId = Number(req.params.id);

        if (!Number.isInteger(permissionId) || permissionId <= 0) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Invalid permission ID."
            });
        }

        const [[permission]] = await connection.query(
            `
            SELECT
                id,
                resource,
                action
            FROM permissions
            WHERE id = ?
            `,
            [permissionId]
        );

        if (!permission) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: "Permission not found."
            });
        }
        const payload = {
            id: permissionId,
            resource: permission.resource,
            action: permission.action
        };

        if (await requiresApproval(connection, req.user.id)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.PERMISSION,
                ACTIONS.DELETE,
                {
                    id: permissionId
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
                recordId: permissionId,
                payload,
                requestedBy: req.user.id
            });

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.DELETE,
                entity: ENTITIES.PERMISSION,
                entityId: permissionId,
                description: `${req.user.name} requested deletion of permission ${permission.resource}:${permission.action}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message: "Permission deletion request sent for approval."
            });

        } else {
            const deletedPermissionId = await executeDeletePermission(
                connection,
                permissionId
            );

            await connection.commit();


            await logActivity({
                userId: req.user.id,
                action: ACTIONS.DELETE,
                entity: ENTITIES.PERMISSION,
                entityId: deletedPermissionId,
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
            resources: PERMISSION_RESOURCE_LIST,
            actions: PERMISSION_ACTION_LIST
        }
    });

};