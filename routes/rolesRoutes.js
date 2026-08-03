import express from 'express'
import { getRoles, createRole, updateRole, deleteRole, getRolePermissions } from "../controllers/roleController.js";
import { authenticate, authorize, authorizePermissions } from "../middleware/authMiddleware.js";
import { PERMISSION_ACTIONS, PERMISSION_RESOURCES } from '../constant/index.js';
import { ROLES } from '../constant/index.js';
import { ROLE_GROUPS } from '../utils/approval.js';

const router = express.Router();

router.use(authenticate);
router.use(authorize(...ROLE_GROUPS.ADMIN_PANEL));

router.get(
    "/",
    authorizePermissions(
        PERMISSION_RESOURCES.ROLES,
        PERMISSION_ACTIONS.READ
    ),
    getRoles
);

router.post(
    "/create",
    authorizePermissions(
        PERMISSION_RESOURCES.ROLES,
        PERMISSION_ACTIONS.CREATE
    ),
    createRole
);

router.put(
    "/:id",
    authorizePermissions(
        PERMISSION_RESOURCES.ROLES,
        PERMISSION_ACTIONS.UPDATE
    ),
    updateRole
);

router.delete(
    "/:id",
    authorizePermissions(
        PERMISSION_RESOURCES.ROLES,
        PERMISSION_ACTIONS.DELETE
    ),
    deleteRole
);

router.get(
    "/:id/permissions",
    authorizePermissions(
        PERMISSION_RESOURCES.ROLES,
        PERMISSION_ACTIONS.READ
    ),
    getRolePermissions
);


export default router;