import { ROLES } from "../constant/index.js";

export const SYSTEM_ROLES = new Set([
    ROLES.SUPER_ADMIN
]);

const APPROVAL_REQUIRED_ROLES = new Set([
    ROLES.ADMIN,
    ROLES.TEST
]);

export const ROLE_MANAGEMENT = {
    [ROLES.SUPER_ADMIN]: new Set(Object.values(ROLES)),

    [ROLES.ADMIN]: new Set([    //Current user role
        ROLES.ADMIN,            //Can manage this roles
        ROLES.TEST              //Can manage this roles
    ])
};

export const requiresApproval = (user) =>
    user.roles?.some(role => APPROVAL_REQUIRED_ROLES.has(role)) ?? false;

export const isSystemRole = (roleName) =>
    SYSTEM_ROLES.has(roleName);

export const canManageRole = (user, roleName) =>
    user.roles?.some(role =>
        ROLE_MANAGEMENT[role]?.has(roleName)
    ) ?? false;