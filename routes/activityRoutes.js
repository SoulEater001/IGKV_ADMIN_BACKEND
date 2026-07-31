import express from "express";
import { ROLE_GROUPS, SYSTEM_ROLES } from "../utils/approval.js";
import { getActivityLogsPaginated } from "../controllers/activityController.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js"

const router = express.Router();

router.get(
    "/paginated",
    authenticate,
    authorize(...ROLE_GROUPS.SYSTEM),
    getActivityLogsPaginated
);

export default router;