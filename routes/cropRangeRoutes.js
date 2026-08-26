import express from "express";
import {
    getCropRangesPaginated,
    getCropRangeStages,
    createCropRange,
    updateCropRange,
    deleteCropRange
} from "../controllers/cropRangeController.js";
import { authenticate, authorizePermissions, authorize } from "../middleware/authMiddleware.js";
import { ROLE_GROUPS } from "../utils/approval.js";
import { PERMISSION_RESOURCES, PERMISSION_ACTIONS } from "../constant/index.js";

const router = express.Router();

router.use(authenticate);
router.use(authorize(...ROLE_GROUPS.ADMIN_PANEL));

router.get(
    "/paginated",
    authorizePermissions(PERMISSION_RESOURCES.CROP_STAGES, PERMISSION_ACTIONS.READ),
    getCropRangesPaginated
);

router.get(
    "/stages",
    authorizePermissions(PERMISSION_RESOURCES.CROP_STAGES, PERMISSION_ACTIONS.READ),
    getCropRangeStages
);

router.post(
    "/create",
    authorizePermissions(PERMISSION_RESOURCES.CROP_STAGES, PERMISSION_ACTIONS.CREATE),
    createCropRange
);

router.put(
    "/:id",
    authorizePermissions(PERMISSION_RESOURCES.CROP_STAGES, PERMISSION_ACTIONS.UPDATE),
    updateCropRange
);

router.delete(
    "/:id",
    authorizePermissions(PERMISSION_RESOURCES.CROP_STAGES, PERMISSION_ACTIONS.DELETE),
    deleteCropRange
);

export default router;