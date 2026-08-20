import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/authMiddleware.js";
import { ROLE_GROUPS } from "../utils/approval.js";
import { bulkUpsertForecasts, getForecasts, getExistingForecastOptions, getForecastsWithOptions } from "../controllers/weatherForecastController.js";

const router = express.Router();

router.use(authenticate);
router.use(authorize(...ROLE_GROUPS.ADMIN_PANEL));

router.get(
    '/',
    getForecasts
);

router.get(
    '/load-existing',
    getForecastsWithOptions
);

router.get(
    '/existing-options',
    getExistingForecastOptions
);

router.post(
  '/bulk-upsert',
  bulkUpsertForecasts
);

export default router;