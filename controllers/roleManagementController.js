import { pool } from "../config/db.js";
import { logActivity } from "../utils/activityLogger.js";
import { ACTIONS } from "../constant/activityActions.js";
import { ENTITIES } from "../constant/activityEntities.js";
import { executeUpdateRoleManagement } from "../services/roleManagementService.js";
import { canManageRole } from "../utils/approval.js";

export const getRoleManagement = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `
            SELECT
                manager_role.id AS manager_role_id,
                manager_role.name AS manager_role_name,
                target_role.id AS target_role_id,
                target_role.name AS target_role_name

            FROM roles manager_role

            LEFT JOIN role_management rm
                ON rm.manager_role_id = manager_role.id

            LEFT JOIN roles target_role
                ON target_role.id = rm.target_role_id
               AND target_role.is_active = 1

            WHERE manager_role.is_active = 1

            ORDER BY
                manager_role.name ASC,
                target_role.name ASC
            `
        );

        const grouped = {};

        for (const row of rows) {

            if (!grouped[row.manager_role_id]) {
                grouped[row.manager_role_id] = {
                    manager_role_id: row.manager_role_id,
                    manager_role_name: row.manager_role_name,
                    target_roles: []
                };
            }

            if (row.target_role_id) {
                grouped[row.manager_role_id].target_roles.push({
                    id: row.target_role_id,
                    name: row.target_role_name
                });
            }
        }

        return res.status(200).json({
            success: true,
            data: Object.values(grouped)
        });

    } catch (error) {

        console.error(
            "Error fetching role management:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch role management."
        });
    }
};

export const getRoleManagementByManager = async (req, res) => {
    try {
        const managerRoleId = Number(req.params.managerRoleId);

        if (!Number.isInteger(managerRoleId) || managerRoleId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid manager role ID."
            });
        }

        const [[managerRole]] = await pool.query(
            `
            SELECT
                id,
                name,
                is_active
            FROM roles
            WHERE id = ?
            `,
            [managerRoleId]
        );

        if (!managerRole) {
            return res.status(404).json({
                success: false,
                message: "Manager role not found."
            });
        }

        const [rows] = await pool.query(
            `
            SELECT
                r.id,
                r.name

            FROM role_management rm

            JOIN roles r
                ON r.id = rm.target_role_id

            WHERE rm.manager_role_id = ?
              AND r.is_active = 1

            ORDER BY r.name ASC
            `,
            [managerRoleId]
        );

        return res.status(200).json({
            success: true,
            data: {
                manager_role_id: managerRole.id,
                manager_role_name: managerRole.name,
                target_roles: rows
            }
        });

    } catch (error) {
        console.error("Error fetching role management:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch role management."
        });
    }
};

export const updateRoleManagement = async (req, res) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const managerRoleId = Number(req.params.managerRoleId);
        const { targetRoleIds = [] } = req.body;

        if (!Number.isInteger(managerRoleId) || managerRoleId <= 0) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Invalid manager role ID."
            });
        }

        if (!Array.isArray(targetRoleIds)) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Target role IDs must be an array."
            });
        }

        const normalizedTargetRoleIds = [
            ...new Set(
                targetRoleIds.map(Number)
            )
        ];

        if (
            normalizedTargetRoleIds.some(
                id => !Number.isInteger(id) || id <= 0
            )
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "One or more target role IDs are invalid."
            });
        }

        const [[managerRole]] = await connection.query(
            `
            SELECT
                id,
                name,
                is_system,
                is_active
            FROM roles
            WHERE id = ?
            `,
            [managerRoleId]
        );

        if (!managerRole) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Manager role not found."
            });
        }

        if (!managerRole.is_active) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Manager role is inactive."
            });
        }

        /*
         * The actor must be allowed to manage the manager role itself.
         */
        const canManageManagerRole = await canManageRole(
            connection,
            req.user.id,
            managerRoleId
        );

        if (!canManageManagerRole) {
            await connection.rollback();

            return res.status(403).json({
                success: false,
                message: `You cannot modify role management for the ${managerRole.name} role.`
            });
        }

        /*
         * Determine whether the current user has a system role.
         */
        const [[systemRole]] = await connection.query(
            `
            SELECT 1
            FROM user_roles ur

            JOIN roles r
                ON r.id = ur.role_id

            WHERE ur.user_id = ?
              AND r.is_active = 1
              AND r.is_system = 1

            LIMIT 1
            `,
            [req.user.id]
        );

        const isSystemUser = !!systemRole;

        /*
         * A non-system user cannot modify a system manager role.
         */
        if (managerRole.is_system && !isSystemUser) {
            await connection.rollback();

            return res.status(403).json({
                success: false,
                message: `You cannot modify role management for the system role ${managerRole.name}.`
            });
        }

        let targetRoles = [];

        if (normalizedTargetRoleIds.length > 0) {

            const [rows] = await connection.query(
                `
                SELECT
                    id,
                    name,
                    is_system
                FROM roles
                WHERE id IN (?)
                  AND is_active = 1
                `,
                [normalizedTargetRoleIds]
            );

            if (rows.length !== normalizedTargetRoleIds.length) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message: "One or more target roles are invalid or inactive."
                });
            }

            targetRoles = rows;
        }

        /*
         * A non-system user cannot add/remove access to system roles.
         */
        const containsSystemTarget = targetRoles.some(
            role => role.is_system
        );

        if (containsSystemTarget && !isSystemUser) {
            await connection.rollback();

            return res.status(403).json({
                success: false,
                message: "Only a system role user can manage system roles."
            });
        }

        /*
         * Verify that the actor is allowed to manage every target role.
         */
        for (const targetRole of targetRoles) {

            const allowed = await canManageRole(
                connection,
                req.user.id,
                targetRole.id
            );

            if (!allowed) {
                await connection.rollback();

                return res.status(403).json({
                    success: false,
                    message: `You cannot manage the ${targetRole.name} role.`
                });
            }
        }

        const payload = {
            managerRoleId,
            targetRoleIds: normalizedTargetRoleIds
        };

        if (await requiresApproval(connection, req.user.id)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.ROLE_MANAGEMENT,
                ACTIONS.UPDATE,
                {
                    id: managerRoleId
                }
            );

            if (pending) {
                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: `A role management update for ${managerRole.name} is already pending.`
                });
            }

            await createApprovalRequest(connection, {
                resource: ENTITIES.ROLE_MANAGEMENT,
                action: ACTIONS.UPDATE,
                recordId: managerRoleId,
                payload,
                requestedBy: req.user.id
            });

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.UPDATE,
                entity: ENTITIES.ROLE_MANAGEMENT,
                entityId: managerRoleId,
                description:
                    `${req.user.name} requested role management update for ${managerRole.name}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message: "Role management update sent for approval."
            });
        }

        await executeUpdateRoleManagement(
            connection,
            payload,
            req.user.id
        );

        await connection.commit();

        await logActivity({
            userId: req.user.id,
            action: ACTIONS.UPDATE,
            entity: ENTITIES.ROLE_MANAGEMENT,
            entityId: managerRoleId,
            description:
                `${req.user.name} updated role management for ${managerRole.name}`,
            ipAddress: req.ip
        });

        return res.status(200).json({
            success: true,
            message: "Role management updated successfully."
        });

    } catch (error) {

        await connection.rollback();

        console.error("Error updating role management:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update role management."
        });

    } finally {
        connection.release();
    }
};