import { pool } from "../config/db.js";
import { logActivity } from '../utils/activityLogger.js'
import { ACTIONS } from "../constant/activityActions.js";
import { ENTITIES } from "../constant/activityEntities.js";
import { createApprovalRequest, hasPendingApproval } from "../services/approvalService.js";
import { ROLES } from "../constant/index.js";
import { executeCreateRole, executeDeleteRole } from '../services/roleService.js'
import {requiresApproval, canManageRole, isSystemRole} from '../utils/approval.js'

export const getRoles = async (req, res) => {
    try {

        const [rows] = await pool.query(`
            SELECT
                id,
                name,
                description
            FROM roles
            ORDER BY name ASC
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
            message: "Failed to fetch roles."
        });

    }
};

export const createRole = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const {
            name,
            description
        } = req.body;
        console.log(req.user)

        if (!name?.trim()) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: "Role name is required."
            });
        }

        const [[existing]] = await connection.query(
            `
            SELECT id
            FROM roles
            WHERE name = ?
            `,
            [name.trim()]
        );

        if (existing) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: "Role already exists."
            });
        }

        const roleData = {
            name: name.trim(),
            description: description?.trim() || null
        };

        if (!canManageRole(req.user, roleData.name)) {

            await connection.rollback();

            return res.status(403).json({
                success: false,
                message: "You are not allowed to create a Super Admin role."
            });

        }
        if (requiresApproval(req.user)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.ROLE,
                ACTIONS.CREATE,
                {
                   name: roleData.name
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "A role creation request with this name is already pending."
                });

            }

            await createApprovalRequest(connection, {
                resource: ENTITIES.ROLE,
                action: ACTIONS.CREATE,
                payload: roleData,
                requestedBy: req.user.id
            });

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.CREATE,
                entity: ENTITIES.ROLE,
                entityId: req.user.id,
                description: `${req.user.name} requested creation of user ${roleData.name}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message: "Role creation request sent for approval."
            });

        } else {



            const roleId = await executeCreateRole(
                connection,
                roleData
            );

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.CREATE,
                entity: ENTITIES.ROLE,
                entityId: roleId,
                description: `${req.user.name} created role ${roleData.name}`,
                ipAddress: req.ip
            });

            return res.status(201).json({
                success: true,
                message: "Role created successfully.",
                data: {
                    id: roleId
                }
            });
        }
    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to create role."
        });

    }finally {

        connection.release();

    }
};

export const updateRole = async (req, res) => {
    try {

        const { id } = req.params;

        const {
            name,
            description
        } = req.body;

        if (!name?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Role name is required."
            });
        }

        const [[role]] = await pool.query(
            `
            SELECT id, name
            FROM roles
            WHERE id = ?
            `,
            [id]
        );

        if (!role) {
            return res.status(404).json({
                success: false,
                message: "Role not found."
            });
        }

        const [[existing]] = await pool.query(
            `
            SELECT id
            FROM roles
            WHERE name = ?
              AND id <> ?
            `,
            [
                name.trim(),
                id
            ]
        );

        if (existing) {
            return res.status(409).json({
                success: false,
                message: "Role already exists."
            });
        }

        await pool.query(
            `
            UPDATE roles
            SET
                name = ?,
                description = ?
            WHERE id = ?
            `,
            [
                name.trim(),
                description?.trim() || null,
                id
            ]
        );

        await logActivity({
            userId: req.user.id,
            action: ACTIONS.UPDATE,
            entity: ENTITIES.ROLE,
            entityId: id,
            description: `${req.user.name} updated role ${name.trim()}`,
            ipAddress: req.ip
        });

        return res.status(200).json({
            success: true,
            message: "Role updated successfully."
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to update role."
        });

    }
};

export const deleteRole = async (req, res) => {
    const connection = await pool.getConnection();
    try {

        const { id } = req.params;
        await connection.beginTransaction();
        const [[role]] = await connection.query(
            `
            SELECT id, name
            FROM roles
            WHERE id = ?
            `,
            [id]
        );

        if (!role) {
            return res.status(404).json({
                success: false,
                message: "Role not found."
            });
        }

        const payload = {
            id: role.id,
            name: role.name
        };

        if (isSystemRole(role.name)) {

            await connection.rollback();

            return res.status(403).json({
                success: false,
                message: "The Super Admin role cannot be deleted."
            });

        }
        if (requiresApproval(req.user)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.ROLE,
                ACTIONS.DELETE,
                {
                    id: role.id
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "A delete request for this role is already pending."
                });

            }
            await createApprovalRequest(connection, {
                resource: ENTITIES.ROLE,
                action: ACTIONS.DELETE,
                recordId: role.id,
                payload,
                requestedBy: req.user.id
            });

            await connection.commit();

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message: "Role deletion request sent for approval."
            });
        } else {

            const deletedRoleId = await executeDeleteRole(
                connection,
                role.id
            );

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.DELETE,
                entity: ENTITIES.ROLE,
                entityId: deletedRoleId,
                description: `${req.user.name} deleted role ${role.name}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                message: "Role deleted successfully."
            });
        }
    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete role."
        });

    }finally {

        connection.release();

    }
};

export const getRolePermissions = async (req, res) => {
    try {

        const { id } = req.params;

        const [[role]] = await pool.query(
            `
            SELECT
                id,
                name,
                description
            FROM roles
            WHERE id = ?
            `,
            [id]
        );

        if (!role) {
            return res.status(404).json({
                success: false,
                message: "Role not found."
            });
        }

        const [permissions] = await pool.query(
            `
            SELECT
                permission_id
            FROM role_permissions
            WHERE role_id = ?
            ORDER BY permission_id
            `,
            [id]
        );

        return res.status(200).json({
            success: true,
            data: {
                role,
                permissionIds: permissions.map(
                    permission => permission.permission_id
                )
            }
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch role permissions."
        });

    }
};

export const updateRolePermissions = async (req, res) => {

    const connection = await pool.getConnection();

    try {

        const { id } = req.params;

        const { permissionIds = [] } = req.body;

        const [[role]] = await connection.query(
            `
            SELECT id, name
            FROM roles
            WHERE id = ?
            `,
            [id]
        );

        if (!role) {

            connection.release();

            return res.status(404).json({
                success: false,
                message: "Role not found."
            });

        }

        const [validPermissions] = await connection.query(
            `
    SELECT id
    FROM permissions
    WHERE id IN (?)
    `,
            [permissionIds]
        );

        if (validPermissions.length !== permissionIds.length) {

            connection.release();

            return res.status(400).json({
                success: false,
                message: "One or more permission IDs are invalid."
            });

        }

        await connection.beginTransaction();

        await connection.query(
            `
            DELETE
            FROM role_permissions
            WHERE role_id = ?
            `,
            [id]
        );

        if (permissionIds.length > 0) {

            const values = permissionIds.map(permissionId => [
                id,
                permissionId
            ]);

            await connection.query(
                `
                INSERT INTO role_permissions
                (
                    role_id,
                    permission_id
                )
                VALUES ?
                `,
                [values]
            );

        }

        await connection.commit();

        await logActivity({
            userId: req.user.id,
            action: ACTIONS.UPDATE,
            entity: ENTITIES.ROLE,
            entityId: id,
            description: `${req.user.name} updated permissions for role ${role.name} (${permissionIds.length} permissions)`,
            ipAddress: req.ip
        });

        connection.release();

        return res.status(200).json({
            success: true,
            message: "Role permissions updated successfully."
        });

    } catch (error) {

        await connection.rollback();

        connection.release();

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to update role permissions."
        });

    }

};