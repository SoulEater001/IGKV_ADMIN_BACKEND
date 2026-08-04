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

export const SYSTEM_ROLES = new Set(ROLE_GROUPS.SYSTEM);

const APPROVAL_REQUIRED_ROLES = new Set([
    ROLES.ADMIN,
    ROLES.TEST,
]);

export const ROLE_MANAGEMENT = {
    [ROLES.SUPER_ADMIN]: new Set(Object.values(ROLES)),

    [ROLES.ADMIN]: new Set([    //Current user role
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

    export const canManageUser = (user, targetRoles) =>
    targetRoles.every(role =>
        canManageRole(user, role)
    );