import e from "express";
import { getWeatherStations, createWeatherStation, updateWeatherStation, deleteWeatherStation, activateWeatherStation, getWeatherStationsPaginated } from "../controllers/weatherStationController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { authorizePermissions } from "../middleware/authMiddleware.js";
import { PERMISSION_ACTIONS, PERMISSION_RESOURCES } from "../constant/index.js";
const router = e.Router();

router.use(authenticate);


router.get("",
    authorizePermissions(
        PERMISSION_RESOURCES.WEATHER,
        PERMISSION_ACTIONS.READ
    ),
    getWeatherStations
);
router.get("/paginated",
    authorizePermissions(
        PERMISSION_RESOURCES.WEATHER,
        PERMISSION_ACTIONS.READ
    ),
    getWeatherStationsPaginated
);
router.post("/create",
    authorizePermissions(
        PERMISSION_RESOURCES.WEATHER,
        PERMISSION_ACTIONS.CREATE
    ),
    createWeatherStation
);
router.put("/:id",
    authorizePermissions(
        PERMISSION_RESOURCES.WEATHER,
        PERMISSION_ACTIONS.UPDATE
    ),
    updateWeatherStation
);
router.delete("/:id",
    authorizePermissions(
        PERMISSION_RESOURCES.WEATHER,
        PERMISSION_ACTIONS.DELETE
    ),
    deleteWeatherStation
);
router.patch("/:id/activate",
    authorizePermissions(
        PERMISSION_RESOURCES.WEATHER,
        PERMISSION_ACTIONS.UPDATE
    ),
    activateWeatherStation
);

export default router;