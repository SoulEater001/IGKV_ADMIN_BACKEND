import e from "express";
import { getWeatherStations, createWeatherStation, updateWeatherStation, deleteWeatherStation, activateWeatherStation, getWeatherStationsPaginated } from "../controllers/weatherStationController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/authMiddleware.js";
import { ROLE_GROUPS } from "../utils/approval.js";

const router = e.Router();

router.use(authenticate);
router.use(authorize(...ROLE_GROUPS.ADMIN_PANEL));

router.get("", getWeatherStations);
router.get("/paginated", getWeatherStationsPaginated);
router.post("/create", createWeatherStation);
router.put("/:id", updateWeatherStation);
router.delete("/:id", deleteWeatherStation);
router.patch("/:id/activate", activateWeatherStation);

export default router;