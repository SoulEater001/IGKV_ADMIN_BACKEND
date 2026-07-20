import { pool } from "../config/db.js";

export const getAuthenticatedUser = async (connection, userId) => {

    const executor = connection ?? pool;

    const [userRows] = await executor.query(
        `
        SELECT
            u.id,
            u.name,
            u.email,
            u.is_active,
            u.token_version,

            r.name AS role

        FROM admin_users u

        LEFT JOIN user_roles ur
            ON u.id = ur.user_id

        LEFT JOIN roles r
            ON ur.role_id = r.id

        WHERE u.id = ?
        `,
        [userId]
    );

    if (userRows.length === 0) {
        return null;
    }

    const user = userRows[0];

    const roles = [
        ...new Set(
            userRows
                .map(row => row.role)
                .filter(Boolean)
        )
    ];

    const [permissionRows] = await executor.query(
        `
        SELECT DISTINCT
            p.resource,
            p.action

        FROM user_roles ur

        JOIN role_permissions rp
            ON ur.role_id = rp.role_id

        JOIN permissions p
            ON rp.permission_id = p.id

        WHERE ur.user_id = ?
        `,
        [userId]
    );

    const permissions = permissionRows.map(
        permission => `${permission.resource}:${permission.action}`
    );

    return {
        id: user.id,
        name: user.name,
        email: user.email,
        isActive: user.is_active,
        tokenVersion: user.token_version,
        roles,
        permissions
    };
};