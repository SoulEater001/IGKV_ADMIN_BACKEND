import express from "express";
import { getDistrictById, createDistrict, updateDistrict, deleteDistrict, getDistricts, getDistrictsPaginated } from "../controllers/districtController.js";
import { authenticate, authorize, authorizePermissions } from "../middleware/authMiddleware.js";
import { PERMISSION_ACTIONS, PERMISSION_RESOURCES } from "../constant/index.js";
import { ROLE_GROUPS } from "../utils/approval.js";

const router = express.Router();

router.use(authenticate);
router.use(authorize(...ROLE_GROUPS.ADMIN_PANEL));

router.get("/",
    authorizePermissions(PERMISSION_RESOURCES.DISTRICT, PERMISSION_ACTIONS.READ),
    getDistricts
);
router.get("/paginated",
    authorizePermissions(PERMISSION_RESOURCES.DISTRICT, PERMISSION_ACTIONS.READ),
    getDistrictsPaginated
);

router.get("/:id",
    authorizePermissions(
        PERMISSION_RESOURCES.DISTRICT,
        PERMISSION_ACTIONS.READ
    ),
    getDistrictById);

router.post(
    "/create",
    authorizePermissions(
        PERMISSION_RESOURCES.DISTRICT,
        PERMISSION_ACTIONS.CREATE
    ),
    createDistrict
);

router.put(
    "/:id",
    authorizePermissions(
        PERMISSION_RESOURCES.DISTRICT,
        PERMISSION_ACTIONS.UPDATE
    ),
    updateDistrict
);

router.delete(
    "/:id",
    authorizePermissions(
        PERMISSION_RESOURCES.DISTRICT,
        PERMISSION_ACTIONS.DELETE
    ),
    deleteDistrict
);

export default router;