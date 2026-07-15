import express from "express";
import { updateCrop, deleteCrop, createCrop, getCropsPaginated } from "../controllers/cropController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();


router.get("/paginated", getCropsPaginated);

router.post("/create", authenticate, createCrop);

router.put("/:id", authenticate, updateCrop);

router.delete("/:id", authenticate, deleteCrop);

export default router;