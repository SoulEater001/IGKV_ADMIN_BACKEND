import express from "express";
import { SYSTEM_ROLES } from "../utils/approval.js";
import { getActivityLogsPaginated } from "../controllers/activityController.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js"

const router = express.Router();

router.get(
    "/paginated",
    authenticate,
    authorize(...SYSTEM_ROLES),
    getActivityLogsPaginated
);

export default router;