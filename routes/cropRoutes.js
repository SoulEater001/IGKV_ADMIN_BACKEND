import express from "express";
import { getCrops , updateCrop, deleteCrop, createCrop} from "../controllers/cropController.js";

const router = express.Router();


router.get("/", getCrops);

router.post("/create", createCrop);

router.put("/:id", updateCrop);

router.delete("/:id", deleteCrop);

export default router;