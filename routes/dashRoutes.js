import express from 'express'
import { getDashboardStats, getActivities, getPendingApprovalCount } from '../controllers/dashController.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js'
import { ROLES } from '../constant/index.js';
import { SYSTEM_ROLES } from '../utils/approval.js';

const router = express.Router();

router.get("/stats", getDashboardStats);
router.get(
    "/activities",
    authenticate,
    authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN),
    getActivities
);

router.get("/pending/count", authenticate, authorize(...SYSTEM_ROLES), getPendingApprovalCount);

export default router;