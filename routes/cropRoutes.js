import express from "express";
import { updateCrop, deleteCrop, createCrop, getCropsPaginated , getCrops} from "../controllers/cropController.js";
import { authenticate, authorize , authorizePermissions} from "../middleware/authMiddleware.js";
import { PERMISSION_ACTIONS, PERMISSION_RESOURCES } from "../constant/index.js";
import { ROLE_GROUPS } from "../utils/approval.js";

const router = express.Router();

router.use(authenticate);
router.use(authorize(...ROLE_GROUPS.ADMIN_PANEL));

router.get("/", 
    authorizePermissions(PERMISSION_RESOURCES.CROPS, PERMISSION_ACTIONS.READ),
    getCrops
);
router.get(
    "/paginated",
    authorizePermissions(PERMISSION_RESOURCES.CROPS, PERMISSION_ACTIONS.READ),
    getCropsPaginated
);



router.post(
    "/create",
    authorizePermissions(
        PERMISSION_RESOURCES.CROPS,
        PERMISSION_ACTIONS.CREATE
    ),
    createCrop
);

router.put(
    "/:id",
    authorizePermissions(
        PERMISSION_RESOURCES.CROPS,
        PERMISSION_ACTIONS.UPDATE
    ),
    updateCrop
);

router.delete(
    "/:id",
    authorizePermissions(
        PERMISSION_RESOURCES.CROPS,
        PERMISSION_ACTIONS.DELETE
    ),
    deleteCrop
);

export default router;