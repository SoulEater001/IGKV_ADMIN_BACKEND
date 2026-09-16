import express from "express";

import {
    getCropStages,
    getCropStagesPaginated,
    createCropStage,
    updateCropStage,
    deleteCropStage
} from "../controllers/cropStageController.js";
import { authenticate, authorizePermissions } from "../middleware/authMiddleware.js";
import { PERMISSION_RESOURCES,PERMISSION_ACTIONS } from "../constant/index.js";

const router = express.Router();

router.use(authenticate);


router.get(
    "/paginated",
    authorizePermissions(PERMISSION_RESOURCES.CROP_STAGES, PERMISSION_ACTIONS.READ),
    getCropStagesPaginated
);


router.get(
    "/",
    authorizePermissions(PERMISSION_RESOURCES.CROP_STAGES, PERMISSION_ACTIONS.READ),
    getCropStages
);


router.post(
    "/create",
    authorizePermissions(PERMISSION_RESOURCES.CROP_STAGES, PERMISSION_ACTIONS.CREATE),
    createCropStage
);


router.put(
    "/:id",
    authorizePermissions(PERMISSION_RESOURCES.CROP_STAGES, PERMISSION_ACTIONS.UPDATE),
    updateCropStage
);


router.delete(
    "/:id",
    authorizePermissions(PERMISSION_RESOURCES.CROP_STAGES, PERMISSION_ACTIONS.DELETE),
    deleteCropStage
);


export default router;