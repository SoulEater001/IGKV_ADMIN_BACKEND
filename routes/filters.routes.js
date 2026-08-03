import express from "express";
import * as filterController from "../controllers/filters.controller.js";

const router = express.Router();

router.get("/locations", filterController.fetchLocationHierarchy);
router.get("/crops", filterController.fetchCropList);
router.get("/districts", filterController.getAllDistricts);

export default router;
