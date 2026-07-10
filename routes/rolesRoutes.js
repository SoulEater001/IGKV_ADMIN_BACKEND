import express from 'express'
import { getRoles, createRole, updateRole, deleteRole, getRolePermissions, updateRolePermissions } from "../controllers/roleController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authenticate, getRoles);

router.post("/create", authenticate, createRole);

router.put("/:id", authenticate, updateRole);

router.delete("/:id", authenticate, deleteRole);

router.get(
    "/:id/permissions",
    authenticate,
    getRolePermissions
);

router.put(
    "/:id/permissions",
    authenticate,
    updateRolePermissions
);

export default router;