import express from 'express'
import { createAdvisory, getAdvisories, getAdvisoryTypes, createAdvisoryType,updateAdvisoryType, deleteAdvisoryType } from '../controllers/advisoryController.js';
import { updateAdvisory } from '../controllers/advisoryController.js';

const router = express.Router();

router.get("/", getAdvisories);

router.get("/types", getAdvisoryTypes);
router.post("/types/create", createAdvisoryType);
router.put("/types/:id", updateAdvisoryType);
router.delete("/types/:id", deleteAdvisoryType);

router.put("/:id", updateAdvisory);

router.post("/create", createAdvisory);
router.post("/create", createAdvisory);

export default router;