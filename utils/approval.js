import { pool } from "../config/db.js";

const getExecutor = (connection) => connection ?? pool;

export const requiresApproval = async (connection, userId) => {
    const executor = getExecutor(connection);

    const [rows] = await executor.query(
        `
        SELECT 1
        FROM user_roles ur
        JOIN roles r
            ON r.id = ur.role_id
        WHERE ur.user_id = ?
          AND r.is_active = 1
          AND r.requires_approval = 1
        LIMIT 1
        `,
        [userId]
    );

    return rows.length > 0;
};

export const canManageRole = async (
    connection,
    userId,
    targetRoleId
) => {
    const executor = getExecutor(connection);

    const [rows] = await executor.query(
        `
        SELECT 1
        FROM user_roles ur

        JOIN roles manager_role
            ON manager_role.id = ur.role_id
           AND manager_role.is_active = 1

        JOIN role_management rm
            ON rm.manager_role_id = manager_role.id
           AND rm.target_role_id = ?

        WHERE ur.user_id = ?
        LIMIT 1
        `,
        [targetRoleId, userId]
    );

    return rows.length > 0;
};

export const canManageUser = async (
    connection,
    userId,
    targetRoleIds
) => {
    if (!Array.isArray(targetRoleIds) || targetRoleIds.length === 0) {
        return true;
    }

    const uniqueRoleIds = [
        ...new Set(
            targetRoleIds
                .map(Number)
                .filter(Number.isInteger)
        )
    ];

    if (uniqueRoleIds.length === 0) {
        return true;
    }

    const executor = getExecutor(connection);

    const placeholders = uniqueRoleIds.map(() => "?").join(", ");

    const [rows] = await executor.query(
        `
        SELECT COUNT(DISTINCT rm.target_role_id) AS managed_count
        FROM user_roles ur

        JOIN roles manager_role
            ON manager_role.id = ur.role_id
           AND manager_role.is_active = 1

        JOIN role_management rm
            ON rm.manager_role_id = manager_role.id

        WHERE ur.user_id = ?
          AND rm.target_role_id IN (${placeholders})
        `,
        [userId, ...uniqueRoleIds]
    );

    return Number(rows[0].managed_count) === uniqueRoleIds.length;
};