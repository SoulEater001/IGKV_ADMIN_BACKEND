import express from "express";
import { getDistrictsByZone, getDistrictById, createDistrict, updateDistrict, deleteDistrict, getDistricts, getDistrictOptions } from "../controllers/districtController.js";
import { authenticate } from "../middleware/authMiddleware.js";


const router = express.Router();

router.get("/by-zone", getDistrictsByZone);
router.get("/", getDistricts);
router.get("/master", getDistrictOptions);

router.get("/:id", getDistrictById);

router.post("/create", authenticate, createDistrict);

router.put("/:id", authenticate, updateDistrict);

router.delete("/:id", authenticate, deleteDistrict);

export default router;