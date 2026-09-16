import e from "express";
import { bulkUpsertObservations, getExistingObservationOptions, getObservations, checkObservationAvailability, upsertWeatherObservationSummary } from "../controllers/weatherObservationController.js";
import { authenticate, authorizePermissions } from "../middleware/authMiddleware.js";
import { PERMISSION_ACTIONS, PERMISSION_RESOURCES } from "../constant/index.js";

const router = e.Router();

router.use(authenticate);


router.get("/",
    authorizePermissions(
        PERMISSION_RESOURCES.WEATHER,
        PERMISSION_ACTIONS.READ
    ),
    getObservations
);
router.get("/existing-options",
    authorizePermissions(
        PERMISSION_RESOURCES.WEATHER,
        PERMISSION_ACTIONS.READ
    ),
    getExistingObservationOptions
);
router.post("/bulk-upsert",
    authorizePermissions(
        PERMISSION_RESOURCES.WEATHER,
        PERMISSION_ACTIONS.CREATE
    ),
    bulkUpsertObservations
);
router.get("/availability",
    authorizePermissions(
        PERMISSION_RESOURCES.WEATHER,
        PERMISSION_ACTIONS.READ
    ),
    checkObservationAvailability
);
router.post("/summary/upsert",
    authorizePermissions(
        PERMISSION_RESOURCES.WEATHER,
        PERMISSION_ACTIONS.CREATE
    ),
    upsertWeatherObservationSummary
);
// router.get("/summary/availability",checkObservationSummaryAvailability);

export default router;