import express from 'express'
import { getDashboardStats, getActivities, getPendingApprovalCount } from '../controllers/dashController.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js'
import { ROLE_GROUPS, SYSTEM_ROLES } from '../utils/approval.js';

const router = express.Router();

router.use(authenticate)
router.use(authorize(...ROLE_GROUPS.ADMIN_PANEL))

router.get("/stats", getDashboardStats);
router.get(
    "/activities",
    getActivities
);

router.get("/pending/count",  getPendingApprovalCount);

export default router;