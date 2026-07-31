import express from 'express'
import {
    getPermissions,
    createPermission,
    updatePermission,
    deletePermission,
    getPermissionOptions,
    getPermissionsPaginated
} from "../controllers/permissionController.js";
import { authenticate , authorize} from "../middleware/authMiddleware.js";
import { ROLES } from '../constant/index.js';
import { ROLE_GROUPS } from '../utils/approval.js';

const router = express.Router();

router.get("/", authenticate, getPermissions);

router.get("/paginated", authenticate, getPermissionsPaginated);

router.post("/create", authenticate,authorize(...ROLE_GROUPS.ADMIN_PANEL), createPermission);

// router.put("/:id", authenticate,authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN), updatePermission);

router.delete("/:id", authenticate,authorize(...ROLE_GROUPS.ADMIN_PANEL), deletePermission);

router.get(
    "/options",
    authenticate,
    getPermissionOptions
);

export default router;