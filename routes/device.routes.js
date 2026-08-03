import express from "express";
import * as deviceController from "../controllers/device.controller.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";
import { ROLE_GROUPS } from "../utils/approval.js";

const router = express.Router();

router.use(authenticate)
router.use(authorize(...ROLE_GROUPS.ADMIN_PANEL))

router.post("/", deviceController.createDevice);
router.get("/", deviceController.getAllDevices);
router.get("/dashboard-summary", deviceController.getDashboardSummary);
router.get("/filter", deviceController.filterDevices);
router.get("/user/:mobileNo/devices", deviceController.getDevicesByMobileNo);
router.get("/:deviceId/history", deviceController.getSensorHistory);
router.get("/:deviceId/sensor-history/csv", deviceController.exportSensorHistoryCSV);
router.get("/:deviceId", deviceController.getDeviceById);
router.put("/:deviceId", deviceController.updateDevice);
router.delete("/:deviceId", deviceController.deleteDevice);
router.post("/:deviceId/assign", deviceController.assignDeviceToUser);
router.get("/user/:mobileNo/summary", deviceController.getUserDeviceSummary);
router.get("/user/:mobileNo/ready-devices", deviceController.getReadyDevices);

export default router;
