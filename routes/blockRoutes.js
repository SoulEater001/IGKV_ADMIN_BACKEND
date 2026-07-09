import express from "express";
import { getBlocksByDistrict } from "../controllers/blockController.js";

const router = express.Router();

router.get("/", getBlocksByDistrict);

export default router;