import express from "express";
import * as chartController from "../controllers/chart.controller.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";
import { ROLE_GROUPS } from "../utils/approval.js";

const router = express.Router();

router.use(authenticate)
router.use(authorize(...ROLE_GROUPS.ADMIN_PANEL))

router.get("/by-crop", chartController.getCropDistribution);
router.get("/by-district", chartController.getDistrictDistribution);
router.get("/crop-heatmap", chartController.getCropCountHeatmap);


export default router;
