import express from "express";
import * as chartController from "../controllers/chart.controller.js";
import { authenticate,  } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticate)


router.get("/by-crop", chartController.getCropDistribution);
router.get("/by-district", chartController.getDistrictDistribution);
router.get("/crop-heatmap", chartController.getCropCountHeatmap);
router.get(
  "/dashboard/iot-summary",
  chartController.getIotSummary
);


export default router;
