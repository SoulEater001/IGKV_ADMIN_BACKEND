import e from "express";
import { bulkUpsertObservations, getExistingObservationOptions, getObservations ,checkObservationAvailability,upsertWeatherObservationSummary } from "../controllers/weatherObservationController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/authMiddleware.js";
import { ROLE_GROUPS } from "../utils/approval.js";

const router = e.Router();

router.use(authenticate);
router.use(authorize(...ROLE_GROUPS.ADMIN_PANEL));

router.get("/", getObservations);
router.get("/existing-options",getExistingObservationOptions);
router.post("/bulk-upsert",bulkUpsertObservations);
router.get("/availability",checkObservationAvailability);
router.post("/summary/upsert",upsertWeatherObservationSummary);
// router.get("/summary/availability",checkObservationSummaryAvailability);

export default router;