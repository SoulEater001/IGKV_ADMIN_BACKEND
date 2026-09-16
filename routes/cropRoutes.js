import express from "express";
import { updateCrop, deleteCrop, createCrop, getCropsPaginated , getCrops} from "../controllers/cropController.js";
import { authenticate , authorizePermissions} from "../middleware/authMiddleware.js";
import { PERMISSION_ACTIONS, PERMISSION_RESOURCES } from "../constant/index.js";

const router = express.Router();

router.use(authenticate);


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