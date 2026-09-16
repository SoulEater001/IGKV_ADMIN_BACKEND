import express from "express";
import {
    getSensorAlerts,
    getSensorAlertsPaginated,
    createSensorAlert,
    updateSensorAlert,
    deleteSensorAlert
} from "../controllers/sensorAlertController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(authenticate);


router.get("/", getSensorAlerts);
router.get("/paginated", getSensorAlertsPaginated);
router.post("/create", createSensorAlert);
router.put("/:id", updateSensorAlert);
router.delete("/:id", deleteSensorAlert);

export default router;