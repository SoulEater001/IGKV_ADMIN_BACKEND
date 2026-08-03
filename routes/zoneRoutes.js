import express from "express";
import * as zoneController from "../controllers/zoneController.js";
import {authenticate,authorize,authorizePermissions} from "../middleware/authMiddleware.js";
import {PERMISSION_ACTIONS,PERMISSION_RESOURCES} from "../constant/index.js";
import { ROLE_GROUPS } from "../utils/approval.js";

const router = express.Router();

router.use(authenticate);
router.use(authorize(...ROLE_GROUPS.ADMIN_PANEL));

router.get(
    "/",
    authorizePermissions(
        PERMISSION_RESOURCES.ZONE,
        PERMISSION_ACTIONS.READ
    ),
    zoneController.getZones
);

router.get(
    "/:id",
    authorizePermissions(
        PERMISSION_RESOURCES.ZONE,
        PERMISSION_ACTIONS.READ
    ),
    zoneController.getZoneById
);

router.post(
    "/create",
    authorizePermissions(
        PERMISSION_RESOURCES.ZONE,
        PERMISSION_ACTIONS.CREATE
    ),
    // upload.single("image"),
    zoneController.createZone
);

router.put(
    "/:id",
    authorizePermissions(
        PERMISSION_RESOURCES.ZONE,
        PERMISSION_ACTIONS.UPDATE
    ),
    // upload.single("image"),
    zoneController.updateZone
);

router.delete(
    "/:id",
    authorizePermissions(
        PERMISSION_RESOURCES.ZONE,
        PERMISSION_ACTIONS.DELETE
    ),
    zoneController.deleteZone
);

export default router;