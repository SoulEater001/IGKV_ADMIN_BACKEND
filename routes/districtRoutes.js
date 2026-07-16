import express from "express";
import {getDistrictById, createDistrict, updateDistrict, deleteDistrict, getDistricts, getDistrictsPaginated } from "../controllers/districtController.js";
import { authenticate } from "../middleware/authMiddleware.js";


const router = express.Router();

router.get("/paginated", getDistrictsPaginated);
router.get("/", getDistricts);

router.get("/:id", getDistrictById);

router.post("/create", authenticate, createDistrict);

router.put("/:id", authenticate, updateDistrict);

router.delete("/:id", authenticate, deleteDistrict);

export default router;