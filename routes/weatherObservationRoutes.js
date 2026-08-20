import e from "express";
import { bulkUpsertObservations, getExistingObservationOptions, getObservations } from "../controllers/weatherObservationController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/authMiddleware.js";
import { ROLE_GROUPS } from "../utils/approval.js";

const router = e.Router();

// router.use(authenticate);
// router.use(authorize(...ROLE_GROUPS.ADMIN_PANEL));

router.get("/", getObservations);
router.post("/bulk-upsert",bulkUpsertObservations);
router.get("/existing-options",getExistingObservationOptions);

export default router;