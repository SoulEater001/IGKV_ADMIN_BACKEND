import express from "express";
import * as farmerController from "../controllers/farmer.controller.js";

const router = express.Router();

//Admin
router.get("/summary/districts", farmerController.getDistrictSummary);
router.get("/summary/tehsils", farmerController.getTehsilSummary);
router.get("/summary/villages", farmerController.getVillageSummary);
router.get("/summary/basic-details", farmerController.getFarmerBasicList);
router.get("/summary", farmerController.getHomeSummary);

//Person Details
router.get("/profile-details/:ufId", farmerController.farmerProfileDetails);
router.get("/land-details/:ufId", farmerController.getFarmerLandDetails);
router.get("/crop-details/:ufId", farmerController.getFarmerCropDetails);

export default router;
