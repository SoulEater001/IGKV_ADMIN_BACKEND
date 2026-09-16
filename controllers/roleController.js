import { pool } from "../config/db.js";
import { logActivity } from '../utils/activityLogger.js'
import { ACTIONS } from "../constant/activityActions.js";
import { ENTITIES } from "../constant/activityEntities.js";
import { createApprovalRequest, hasPendingApproval } from "../services/approvalService.js";
import { executeCreateRole, executeDeleteRole, executeUpdateRole } from '../services/roleService.js'
import { requiresApproval, canManageRole } from '../utils/approval.js'

export const getRoles = async (req, res) => {
    try {

        const [rows] = await pool.query(`
            SELECT
                r.id,
                r.name,
                r.description,
            r.requires_approval,
            r.is_system,
            r.is_active,
                COUNT(rp.permission_id) AS permission_count

            FROM roles r

            LEFT JOIN role_permissions rp
                ON rp.role_id = r.id

            GROUP BY
                r.id,
                r.name,
                r.description,
                r.requires_approval,
                r.is_system,
                r.is_active

            ORDER BY r.name ASC
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
            description,
            requires_approval = 1,
            is_system = 0,
            is_active = 1
        } = req.body;

        if (![0, 1].includes(Number(requires_approval))) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "requires_approval must be 0 or 1."
            });
        }

        if (![0, 1].includes(Number(is_active))) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "is_active must be 0 or 1."
            });
        }

        if (![0, 1].includes(Number(is_system))) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "is_system must be 0 or 1."
            });
        }

        if (!name?.trim()) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: "Role name is required."
            });
        }
        const normalizedName = name.trim().toUpperCase();

        const [[existing]] = await connection.query(
            `
            SELECT id
            FROM roles
            WHERE name = ?
            `,
            [normalizedName.trim()]
        );

        if (existing) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: "Role already exists."
            });
        }

        const roleData = {
            name: normalizedName.trim(),
            description: description?.trim() || null,
            requires_approval: Number(requires_approval),
            is_system: Number(is_system),
            is_active: Number(is_active)
        };

        if (await requiresApproval(req.user)) {

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
                entityId: null,
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

    } finally {

        connection.release();

    }
};

export const updateRole = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        const roleId = Number(id);

        if (!Number.isInteger(roleId) || roleId <= 0) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Invalid role ID."
            });
        }

        const {
            name,
            description,
            requires_approval,
            is_active,
            permissionIds = []
        } = req.body;

        if (![0, 1].includes(Number(requires_approval))) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "requires_approval must be 0 or 1."
            });
        }

        if (![0, 1].includes(Number(is_active))) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "is_active must be 0 or 1."
            });
        }

        if (![0, 1].includes(Number(is_system))) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "is_system must be 0 or 1."
            });
        }

        if (!Array.isArray(permissionIds)) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Permission IDs must be an array."
            });
        }

        const normalizedPermissionIds = [
            ...new Set(
                permissionIds.map(Number)
            )
        ];

        const normalizedName = name?.trim().toUpperCase();

        if (!normalizedName?.trim()) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: "Role name is required."
            });
        }

        const [[role]] = await connection.query(
            `
    SELECT
        id,
        name,
        is_system,
        is_active
    FROM roles
    WHERE id = ?
    `,
            [roleId]
        );

        if (!role) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: "Role not found."
            });
        }

        const allowed = await canManageRole(
            connection,
            req.user.id,
            role.id
        );

        if (!allowed) {
            await connection.rollback();

            return res.status(403).json({
                success: false,
                message: `You cannot modify the ${role.name} role.`
            });
        }

        const [[existing]] = await connection.query(
            `
            SELECT id
            FROM roles
            WHERE name = ?
              AND id <> ?
            `,
            [
                normalizedName.trim(),
                roleId
            ]
        );

        if (existing) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: "Role already exists."
            });
        }

        if (normalizedPermissionIds.length > 0) {

            const [validPermissions] = await connection.query(
                `
                SELECT id
                FROM permissions
                WHERE id IN (?)
                `,
                [normalizedPermissionIds]
            );

            if (validPermissions.length !== permissionIds.length) {

                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message: "One or more permission IDs are invalid."
                });

            }

        }


        const roleData = {
            id: roleId,
            name: normalizedName,
            description: description?.trim() || null,
            requires_approval: Number(requires_approval),
            is_active: Number(is_active),
            permissionIds: normalizedPermissionIds
        };

        if (await requiresApproval(connection, req.user.id)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.ROLE,
                ACTIONS.UPDATE,
                {
                    id: roleId
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "An update request for this role is already pending."
                });

            }

            await createApprovalRequest(connection, {
                resource: ENTITIES.ROLE,
                action: ACTIONS.UPDATE,
                recordId: roleId,
                payload: roleData,
                requestedBy: req.user.id
            });

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.UPDATE,
                entity: ENTITIES.ROLE,
                entityId: roleId,
                description: `${req.user.name} requested update of role ${normalizedName}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message: "Role update request sent for approval."
            });

        } else {

            await executeUpdateRole(
                connection,
                roleData
            );
            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.UPDATE,
                entity: ENTITIES.ROLE,
                entityId: roleId,
                description: `${req.user.name} updated role ${normalizedName.trim()}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                message: "Role updated successfully."
            });
        }
    } catch (error) {
        await connection.rollback();
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to update role."
        });

    } finally { connection.release(); }
};

export const deleteRole = async (req, res) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const roleId = Number(req.params.id);

        if (!Number.isInteger(roleId) || roleId <= 0) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Invalid role ID."
            });
        }

        const [[role]] = await connection.query(
            `
            SELECT
                id,
                name,
                is_system,
                is_active
            FROM roles
            WHERE id = ?
            `,
            [roleId]
        );

        if (!role) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Role not found."
            });
        }

        if (role.is_system) {
            await connection.rollback();

            return res.status(403).json({
                success: false,
                message: `The ${role.name} role is a system role and cannot be deleted.`
            });
        }

        const allowed = await canManageRole(
            connection,
            req.user.id,
            role.id
        );

        if (!allowed) {
            await connection.rollback();

            return res.status(403).json({
                success: false,
                message: `You cannot delete the ${role.name} role.`
            });
        }

        const payload = {
            id: role.id,
            name: role.name
        };

        if (await requiresApproval(connection, req.user.id)) {

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

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.DELETE,
                entity: ENTITIES.ROLE,
                entityId: role.id,
                description: `${req.user.name} requested deletion of role ${role.name}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message: "Role deletion request sent for approval."
            });
        }

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

    } catch (error) {
        await connection.rollback();

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message || "Failed to delete role."
        });

    } finally {
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