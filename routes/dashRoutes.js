import express from 'express'
import { getDashboardStats, getActivities} from '../controllers/dashController.js';
import {authenticate, authorize} from '../middleware/authMiddleware.js'

const router = express.Router();

router.get("/stats", getDashboardStats);
router.get(
    "/activities",
    authenticate,
    authorize("SUPER_ADMIN", "ADMIN"),
    getActivities
);

export default router;