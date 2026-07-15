import express from 'express'
import { getDashboardStats, getActivities} from '../controllers/dashController.js';
import {authenticate, authorize} from '../middleware/authMiddleware.js'
import { ROLES } from '../constant/index.js';

const router = express.Router();

router.get("/stats", getDashboardStats);
router.get(
    "/activities",
    authenticate,
    authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN),
    getActivities
);

export default router;