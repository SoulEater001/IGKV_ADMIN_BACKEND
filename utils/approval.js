import { ROLES } from "../constant/index.js";

export const SYSTEM_ROLES = new Set([
    ROLES.SUPER_ADMIN
]);

const APPROVAL_REQUIRED_ROLES = new Set([
    ROLES.ADMIN
]);

export const ROLE_MANAGEMENT = {
    [ROLES.SUPER_ADMIN]: new Set([  //Current user role
        ROLES.SUPER_ADMIN,          //Can manage this roles
        ROLES.ADMIN
    ]),

    [ROLES.ADMIN]: new Set([
        ROLES.ADMIN
    ])
};

export const requiresApproval = (user) =>
    APPROVAL_REQUIRED_ROLES.has(user.role);

export const isSystemRole = (roleName) =>
    SYSTEM_ROLES.has(roleName);

export const canManageRole = (user, roleName) =>
    ROLE_MANAGEMENT[user.role]?.has(roleName) ?? false;