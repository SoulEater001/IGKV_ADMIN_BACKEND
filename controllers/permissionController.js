import { pool } from "../config/db.js";
import { PERMISSION_ACTIONS, PERMISSION_RESOURCES } from "../constant/index.js";
import { logActivity } from '../utils/activityLogger.js'
import { ACTIONS } from "../constant/activityActions.js";
import { ENTITIES } from "../constant/activityEntities.js";

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
    try {

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

        const [[existing]] = await pool.query(
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
            return res.status(409).json({
                success: false,
                message: "Permission already exists."
            });
        }

        const [result] = await pool.query(
            `
            INSERT INTO permissions
            (
                resource,
                action
            )
            VALUES (?, ?)
            `,
            [
                resource.trim(),
                action.trim()
            ]
        );

        await logActivity({
            userId: req.user.id,
            action: ACTIONS.CREATE,
            entity: ENTITIES.PERMISSION,
            entityId: result.insertId,
            description: `${req.user.name} created permission ${resource.trim()}:${action.trim()}`,
            ipAddress: req.ip
        });

        return res.status(201).json({
            success: true,
            message: "Permission created successfully."
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to create permission."
        });

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
    try {

        const { id } = req.params;

        const [[permission]] = await pool.query(
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
            return res.status(404).json({
                success: false,
                message: "Permission not found."
            });
        }

        const [[usage]] = await pool.query(
            `
            SELECT COUNT(*) AS total
            FROM role_permissions
            WHERE permission_id = ?
            `,
            [id]
        );

        if (usage.total > 0) {
            return res.status(409).json({
                success: false,
                message: "Cannot delete permission because it is assigned to one or more roles."
            });
        }

        await pool.query(
            `
            DELETE FROM permissions
            WHERE id = ?
            `,
            [id]
        );

        await logActivity({
            userId: req.user.id,
            action: ACTIONS.DELETE,
            entity: ENTITIES.PERMISSION,
            entityId: id,
            description: `${req.user.name} deleted permission ${permission.resource}:${permission.action}`,
            ipAddress: req.ip
        });

        return res.status(200).json({
            success: true,
            message: "Permission deleted successfully."
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete permission."
        });

    }
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