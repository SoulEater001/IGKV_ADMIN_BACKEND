import express from "express";
import { getDistrictsByZone } from "../controllers/districtController.js";



const router = express.Router();

router.get("/", getDistrictsByZone);

export default router;