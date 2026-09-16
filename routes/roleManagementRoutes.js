import express from "express";

import {
    getRoleManagement,
    getRoleManagementByManager,
    updateRoleManagement
} from "../controllers/roleManagementController.js";

import {
    authenticate,
    authorizePermissions
} from "../middleware/authMiddleware.js";

import {
    PERMISSION_ACTIONS,
    PERMISSION_RESOURCES
} from "../constant/index.js";

const router = express.Router();

router.use(authenticate);

router.get(
    "/",
    authorizePermissions(
        PERMISSION_RESOURCES.ROLE_MANAGEMENT,
        PERMISSION_ACTIONS.READ
    ),
    getRoleManagement
);

router.get(
    "/:managerRoleId",
    authorizePermissions(
        PERMISSION_RESOURCES.ROLE_MANAGEMENT,
        PERMISSION_ACTIONS.READ
    ),
    getRoleManagementByManager
);

router.put(
    "/:managerRoleId",
    authorizePermissions(
        PERMISSION_RESOURCES.ROLE_MANAGEMENT,
        PERMISSION_ACTIONS.UPDATE
    ),
    updateRoleManagement
);

export default router;