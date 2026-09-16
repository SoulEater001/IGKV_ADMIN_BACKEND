import express from "express";
import { authenticate, authorizePermissions } from "../middleware/authMiddleware.js";
import { bulkUpsertForecasts, getForecasts, getExistingForecastOptions, getForecastsWithOptions, upsertWeatherForecastSummary } from "../controllers/weatherForecastController.js";
import { PERMISSION_ACTIONS, PERMISSION_RESOURCES } from "../constant/index.js";

const router = express.Router();

router.use(authenticate);


router.get(
    '/',
    authorizePermissions(
        PERMISSION_RESOURCES.WEATHER,
        PERMISSION_ACTIONS.READ
    ),
    getForecasts
);

router.get(
    '/load-existing',
    authorizePermissions(
        PERMISSION_RESOURCES.WEATHER,
        PERMISSION_ACTIONS.READ
    ),
    getForecastsWithOptions
);

router.get(
    '/existing-options',
    authorizePermissions(
        PERMISSION_RESOURCES.WEATHER,
        PERMISSION_ACTIONS.READ
    ),
    getExistingForecastOptions
);

router.post(
    '/bulk-upsert',
    authorizePermissions(
        PERMISSION_RESOURCES.WEATHER,
        PERMISSION_ACTIONS.CREATE
    ),
    bulkUpsertForecasts
);

router.post("/summary/upsert",
    authorizePermissions(
        PERMISSION_RESOURCES.WEATHER,
        PERMISSION_ACTIONS.CREATE
    ),
    upsertWeatherForecastSummary
);

export default router;