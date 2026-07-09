import express from 'express'
import { getRoles } from "../controllers/roleController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authenticate, getRoles);

export default router;