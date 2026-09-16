export const PERMISSION_ACTIONS = Object.freeze({
    CREATE: "create",
    READ: "read",
    UPDATE: "update",
    DELETE: "delete",
});

export const PERMISSION_ACTION_LIST = Object.freeze(
    Object.values(PERMISSION_ACTIONS)
);

export const PERMISSION_RESOURCES = Object.freeze({
    USERS: "users",
    ROLES: "roles",
    PERMISSIONS: "permissions",
    APPROVALS: "approvals",
    ACTIVITY_LOGS: "activity-logs",
    CATEGORIES: "categories",
    ADVISORY_TYPES: "advisory-types",
    CROPS: "crops",
    CROP_STAGES: "crop-stages",
    ADVISORIES: "advisories",
    STATE: "state",
    ZONE: "zone",
    DISTRICT: "district",
    BLOCK: "block",
    WEATHER: "weather"
});

export const PERMISSION_RESOURCE_LIST = Object.freeze(
    Object.values(PERMISSION_RESOURCES)
);

export const ROLES = {
    ADMIN: "ADMIN",
    SUPER_ADMIN: "SUPER_ADMIN",
    TEST: "TEST"
}

export const APPROVAL_STATUS = {
    APPROVED: "APPROVED",
    REJECTED: "REJECTED",
    PENDING: "PENDING"
}