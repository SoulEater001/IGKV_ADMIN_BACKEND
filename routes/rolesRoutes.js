import express from 'express'
import { getRoles, createRole, updateRole, deleteRole } from "../controllers/roleController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authenticate, getRoles);

router.post("/create", authenticate, createRole);

router.put("/:id", authenticate, updateRole);

router.delete("/:id", authenticate, deleteRole);

export default router;