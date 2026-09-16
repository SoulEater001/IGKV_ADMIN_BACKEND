import { pool } from "../config/db.js";
import { ROLES } from "../constant/index.js";

const SYSTEM = [
    ROLES.SUPER_ADMIN,
];

const ADMIN_PANEL = [
    ROLES.ADMIN,
    ROLES.TEST,
    ...SYSTEM,
];

export const ROLE_GROUPS = Object.freeze({
    SYSTEM,                                 // System-level roles
    ADMIN_PANEL,                            // Access admin application
    APPROVAL: [...SYSTEM],            // Can approve/reject requests
    ALL: Object.values(ROLES),
});

// export const SYSTEM_ROLES = new Set(ROLE_GROUPS.SYSTEM);

// const APPROVAL_REQUIRED_ROLES = new Set([
//     ROLES.ADMIN,
//     ROLES.TEST,
// ]);

// export const ROLE_MANAGEMENT = {
//     [ROLES.SUPER_ADMIN]: new Set(Object.values(ROLES)),

//     [ROLES.ADMIN]: new Set([    //Current user role
//         ROLES.TEST              //Can manage this roles
//     ])
// };

// export const requiresApproval = (user) =>
//     user.roles?.some(role => APPROVAL_REQUIRED_ROLES.has(role)) ?? false;

// export const isSystemRole = (roleName) =>
//     SYSTEM_ROLES.has(roleName);

// export const canManageRole = (user, roleName) =>
//     user.roles?.some(role =>
//         ROLE_MANAGEMENT[role]?.has(roleName)
//     ) ?? false;

// export const canManageUser = (user, targetRoles) =>
//     targetRoles.every(role =>
//         canManageRole(user, role)
// );


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