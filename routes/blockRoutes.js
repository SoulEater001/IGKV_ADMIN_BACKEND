import express from "express";
import { getBlocksByDistrict, getBlockById, getBlocks, updateBlock, createBlock, deleteBlock } from "../controllers/blockController.js";

const router = express.Router();

router.get("/by-district", getBlocksByDistrict);

router.get("/", getBlocks);

router.get("/:id", getBlockById);

router.post("/create", createBlock);

router.put("/:id", updateBlock);

router.delete("/:id", deleteBlock);

export default router;