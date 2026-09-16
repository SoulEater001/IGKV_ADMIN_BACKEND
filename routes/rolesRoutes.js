import express from 'express'
import { getRoles, createRole, updateRole, deleteRole, getRolePermissions } from "../controllers/roleController.js";
import { authenticate, authorizePermissions } from "../middleware/authMiddleware.js";
import { PERMISSION_ACTIONS, PERMISSION_RESOURCES } from '../constant/index.js';

const router = express.Router();

router.use(authenticate);


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