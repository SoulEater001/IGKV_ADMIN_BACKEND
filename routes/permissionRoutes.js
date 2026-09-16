import express from 'express'
import {
    getPermissions,
    createPermission,
    updatePermission,
    deletePermission,
    getPermissionOptions,
    getPermissionsPaginated
} from "../controllers/permissionController.js";
import { authenticate, authorizePermissions } from "../middleware/authMiddleware.js";
import { PERMISSION_RESOURCES, PERMISSION_ACTIONS } from '../constant/index.js';

const router = express.Router();

router.use(authenticate);


router.get("/", 
    authorizePermissions(PERMISSION_RESOURCES.PERMISSIONS, PERMISSION_ACTIONS.READ),
    getPermissions
);

router.get("/paginated", 
    authorizePermissions(PERMISSION_RESOURCES.PERMISSIONS, PERMISSION_ACTIONS.READ),
    getPermissionsPaginated
);

router.post(
    "/create",
    authorizePermissions(
        PERMISSION_RESOURCES.PERMISSIONS,
        PERMISSION_ACTIONS.CREATE
    ),
    createPermission
);

// router.put("/:id", authenticate,authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN), updatePermission);

router.delete(
    "/:id",
    authorizePermissions(
        PERMISSION_RESOURCES.PERMISSIONS,
        PERMISSION_ACTIONS.DELETE
    ),
    deletePermission
);

router.get(
    "/options",
    authorizePermissions(
        PERMISSION_RESOURCES.PERMISSIONS,
        PERMISSION_ACTIONS.READ
    ),
    getPermissionOptions
);

export default router;