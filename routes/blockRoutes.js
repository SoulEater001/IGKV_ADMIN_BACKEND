import express from "express";
import { getBlocksByDistrict, getBlockById, getBlocksPaginated, updateBlock, createBlock, deleteBlock } from "../controllers/blockController.js";
import { authenticate } from '../middleware/authMiddleware.js'

const router = express.Router();

router.get("/by-district", getBlocksByDistrict);

router.get("/paginated", getBlocksPaginated);

router.get("/:id", getBlockById);

router.post("/create", authenticate, createBlock);

router.put("/:id", authenticate, updateBlock);

router.delete("/:id", authenticate, deleteBlock);

export default router;