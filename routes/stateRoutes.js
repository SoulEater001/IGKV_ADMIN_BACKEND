import express from "express";
import { getStates, getStateById, createState, updateState, deleteState } from "../controllers/stateController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", getStates);

router.get("/:id", getStateById);

router.post("/create", authenticate, createState);

router.put("/:id", authenticate, updateState);

router.delete("/:id", authenticate, deleteState);

export default router;