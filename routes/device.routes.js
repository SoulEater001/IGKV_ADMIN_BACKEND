import express from "express";
import * as deviceController from "../controllers/device.controller.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticate)


router.get("/", deviceController.getAllDevices);
router.get("/paginated", deviceController.getDevicesPaginated);
router.get("/dashboard-summary", deviceController.getDashboardSummary);
router.get("/:deviceId", deviceController.getDeviceById);
// router.get("/user/:mobileNo/devices", deviceController.getDevicesByMobileNo);
router.get("/:deviceId/history", deviceController.getSensorHistory);
router.get("/:deviceId/sensor-history/csv", deviceController.exportSensorHistoryCSV);

router.post("/", deviceController.createDevice);
router.put("/:deviceId", deviceController.updateDevice);
router.delete("/:deviceId", deviceController.deleteDevice);

router.post("/:deviceId/assign", deviceController.assignDeviceToUser);
// router.get("/user/:mobileNo/summary", deviceController.getUserDeviceSummary);
// router.get("/user/:mobileNo/ready-devices", deviceController.getReadyDevices);

export default router;
