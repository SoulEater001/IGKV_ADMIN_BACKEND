import express from 'express'
import { getRoles, createRole, updateRole, deleteRole, getRolePermissions } from "../controllers/roleController.js";
import { authenticate, authorize} from "../middleware/authMiddleware.js";
import { ROLES } from '../constant/index.js';
import { ROLE_GROUPS } from '../utils/approval.js';

const router = express.Router();

router.get("/", authenticate, getRoles);

router.post("/create", authenticate, authorize(...ROLE_GROUPS.ADMIN_PANEL), createRole);

router.put("/:id", authenticate, authorize(...ROLE_GROUPS.ADMIN_PANEL), updateRole);

router.delete("/:id", authenticate, authorize(...ROLE_GROUPS.ADMIN_PANEL), deleteRole);

router.get(
    "/:id/permissions",
    authenticate,
    getRolePermissions
);


export default router;