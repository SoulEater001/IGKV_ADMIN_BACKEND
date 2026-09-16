import express from 'express'
import { getDashboardStats, getActivities, getPendingApprovalCount } from '../controllers/dashController.js';
import { authenticate } from '../middleware/authMiddleware.js'

const router = express.Router();

router.use(authenticate)


router.get("/stats", getDashboardStats);
router.get(
    "/activities",
    getActivities
);

router.get("/pending/count",  getPendingApprovalCount);

export default router;