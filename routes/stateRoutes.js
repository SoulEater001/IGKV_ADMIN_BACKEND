import express from "express";
import { getState, getStateById, createState, updateState, deleteState, getStatesPaginated } from "../controllers/stateController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", getState);
router.get("/paginated", getStatesPaginated);

router.get("/:id", getStateById);

router.post("/create", authenticate, createState);

router.put("/:id", authenticate, updateState);

router.delete("/:id", authenticate, deleteState);

export default router;