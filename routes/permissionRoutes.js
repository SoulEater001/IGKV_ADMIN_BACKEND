import express from 'express'
import {
    getPermissions,
    createPermission,
    updatePermission,
    deletePermission,
    getPermissionOptions
} from "../controllers/permissionController.js";
import { authenticate , authorize} from "../middleware/authMiddleware.js";
import { ROLES } from '../constant/index.js';

const router = express.Router();

router.get("/", authenticate, getPermissions);

router.post("/create", authenticate,authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN), createPermission);

router.put("/:id", authenticate,authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN), updatePermission);

router.delete("/:id", authenticate,authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN), deletePermission);

router.get(
    "/options",
    authenticate,
    getPermissionOptions
);

export default router;