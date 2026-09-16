import { canManageRole } from "../utils/approval.js";

export const executeUpdateRoleManagement = async (
    connection,
    payload,
    userId = null
) => {
    const {
        managerRoleId,
        targetRoleIds = []
    } = payload;

    if (
        !Number.isInteger(managerRoleId) ||
        managerRoleId <= 0
    ) {
        throw new Error("Invalid manager role ID.");
    }

    if (!Array.isArray(targetRoleIds)) {
        throw new Error("Target role IDs must be an array.");
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
        throw new Error("One or more target role IDs are invalid.");
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
        throw new Error("Manager role not found.");
    }

    if (!managerRole.is_active) {
        throw new Error("Manager role is inactive.");
    }

    let targetRoles = [];

    if (normalizedTargetRoleIds.length > 0) {

        const [rows] = await connection.query(
            `
            SELECT
                id,
                name,
                is_system,
                is_active
            FROM roles
            WHERE id IN (?)
            `,
            [normalizedTargetRoleIds]
        );

        if (rows.length !== normalizedTargetRoleIds.length) {
            throw new Error(
                "One or more target roles are invalid or inactive."
            );
        }

        if (rows.some(role => !role.is_active)) {
            throw new Error(
                "One or more target roles are inactive."
            );
        }

        targetRoles = rows;
    }

    /*
     * When userId is supplied, this is a request-time
     * authorization check.
     *
     * When the service is called by the approval executor,
     * userId is intentionally omitted because the original
     * request has already been authorized.
     */
    if (userId !== null) {

        const canManageManagerRole = await canManageRole(
            connection,
            userId,
            managerRoleId
        );

        if (!canManageManagerRole) {
            throw new Error(
                `You cannot modify role management for the ${managerRole.name} role.`
            );
        }

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
            [userId]
        );

        const isSystemUser = !!systemRole;

        if (managerRole.is_system && !isSystemUser) {
            throw new Error(
                `You cannot modify role management for the system role ${managerRole.name}.`
            );
        }

        for (const targetRole of targetRoles) {

            if (targetRole.is_system && !isSystemUser) {
                throw new Error(
                    "Only a system role user can manage system roles."
                );
            }

            const allowed = await canManageRole(
                connection,
                userId,
                targetRole.id
            );

            if (!allowed) {
                throw new Error(
                    `You cannot manage the ${targetRole.name} role.`
                );
            }
        }
    }

    /*
     * Final state validation.
     *
     * This runs even during approval execution so an old
     * approval cannot apply inactive/deleted roles.
     */
    if (managerRole.is_system) {

        for (const targetRole of targetRoles) {
            if (!targetRole.is_system && !managerRole.is_system) {
                throw new Error(
                    "Invalid system role management configuration."
                );
            }
        }
    }

    await connection.query(
        `
        DELETE FROM role_management
        WHERE manager_role_id = ?
        `,
        [managerRoleId]
    );

    if (normalizedTargetRoleIds.length > 0) {

        const values = normalizedTargetRoleIds.map(
            targetRoleId => [
                managerRoleId,
                targetRoleId
            ]
        );

        await connection.query(
            `
            INSERT INTO role_management (
                manager_role_id,
                target_role_id
            )
            VALUES ?
            `,
            [values]
        );
    }

    return {
        managerRoleId,
        targetRoleIds: normalizedTargetRoleIds
    };
};