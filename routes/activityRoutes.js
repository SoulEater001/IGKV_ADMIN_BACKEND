import express from "express";
import { getActivityLogsPaginated } from "../controllers/activityController.js";
import { authenticate, authorizePermissions } from "../middleware/authMiddleware.js"
import { PERMISSION_ACTIONS, PERMISSION_RESOURCES } from "../constant/index.js";

const router = express.Router();

router.get(
    "/paginated",
    authenticate,
    authorizePermissions(
        PERMISSION_RESOURCES.ACTIVITY_LOGS,
        PERMISSION_ACTIONS.READ
    ),
    getActivityLogsPaginated
);

export default router;