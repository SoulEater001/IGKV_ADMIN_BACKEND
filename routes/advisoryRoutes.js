import express from 'express'
import { createAdvisory, getAdvisories, getAdvisoryTypes, createAdvisoryType, updateAdvisoryType, deleteAdvisoryType } from '../controllers/advisoryController.js';
import { updateAdvisory, deleteAdvisory } from '../controllers/advisoryController.js';
import {authenticate} from '../middleware/authMiddleware.js'

const router = express.Router();


router.get("/types",authenticate, getAdvisoryTypes);
router.post("/types/create",authenticate, createAdvisoryType);
router.put("/types/:id",authenticate, updateAdvisoryType);
router.delete("/types/:id",authenticate, deleteAdvisoryType);


router.get("/",authenticate, getAdvisories);
router.put("/:id",authenticate, updateAdvisory);
router.post("/create",authenticate, createAdvisory);
router.delete("/:id", authenticate, deleteAdvisory);

export default router;