import express from "express";
import { getDistrictsByZone, getDistrictById, createDistrict, updateDistrict, deleteDistrict,getDistricts } from "../controllers/districtController.js";



const router = express.Router();

router.get("/by-zone", getDistrictsByZone);
router.get("/", getDistricts);

router.get("/:id", getDistrictById);

router.post("/create", createDistrict);

router.put("/:id", updateDistrict);

router.delete("/:id", deleteDistrict);

export default router;