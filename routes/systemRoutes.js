import express from "express";
import { getSystemConstants } from '../controllers/systemController.js'
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();
// router.use(authenticate);


router.get("/", getSystemConstants);


export default router;