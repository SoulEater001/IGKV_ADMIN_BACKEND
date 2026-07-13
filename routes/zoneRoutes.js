import express from "express";
import * as zoneController from "../controllers/zoneController.js";
// import upload from "../middlewares/upload.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", zoneController.getZones);

router.get("/:id", zoneController.getZoneById);

router.post(
    "/create", 
    authenticate,
    // upload.single("image"),
    zoneController.createZone
);

router.put(
    "/:id", 
    authenticate,
    // upload.single("image"),
    zoneController.updateZone
);

router.delete("/:id", authenticate, zoneController.deleteZone);

export default router;