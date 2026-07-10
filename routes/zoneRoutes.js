import express from "express";
import * as zoneController from "../controllers/zoneController.js";
// import upload from "../middlewares/upload.js";

const router = express.Router();

router.get("/", zoneController.getZones);

router.get("/:id", zoneController.getZoneById);

router.post(
    "/create",
    // upload.single("image"),
    zoneController.createZone
);

router.put(
    "/:id",
    // upload.single("image"),
    zoneController.updateZone
);

router.delete("/:id", zoneController.deleteZone);

export default router;