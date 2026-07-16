import express from 'express'
import { getRoles, createRole, updateRole, deleteRole, getRolePermissions } from "../controllers/roleController.js";
import { authenticate, authorize} from "../middleware/authMiddleware.js";
import { ROLES } from '../constant/index.js';

const router = express.Router();

router.get("/", authenticate, getRoles);

router.post("/create", authenticate, authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN), createRole);

router.put("/:id", authenticate, authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN), updateRole);

router.delete("/:id", authenticate, authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN), deleteRole);

router.get(
    "/:id/permissions",
    authenticate,
    getRolePermissions
);


export default router;