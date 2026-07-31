import express from 'express'
import { getDashboardStats, getActivities, getPendingApprovalCount } from '../controllers/dashController.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js'
import { ROLES } from '../constant/index.js';
import { ROLE_GROUPS, SYSTEM_ROLES } from '../utils/approval.js';

const router = express.Router();

router.get("/stats", getDashboardStats);
router.get(
    "/activities",
    authenticate,
    authorize(...ROLE_GROUPS.ADMIN_PANEL),
    getActivities
);

router.get("/pending/count", authenticate, authorize(...ROLE_GROUPS.SYSTEM), getPendingApprovalCount);

export default router;