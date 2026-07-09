import express from 'express'
import {
    getPermissions,
    createPermission,
    updatePermission,
    deletePermission,
    getPermissionOptions
} from "../controllers/permissionController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authenticate, getPermissions);

router.post("/create", authenticate, createPermission);

router.put("/:id", authenticate, updatePermission);

router.delete("/:id", authenticate, deletePermission);

router.get(
    "/options",
    authenticate,
    getPermissionOptions
);

export default router;