import express from "express";
import { getCrops, updateCrop, deleteCrop, createCrop } from "../controllers/cropController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();


router.get("/", getCrops);

router.post("/create", authenticate, createCrop);

router.put("/:id", authenticate, updateCrop);

router.delete("/:id", authenticate, deleteCrop);

export default router;