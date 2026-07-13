import express from "express"
import { getCategories, createCategory, updateCategory, deleteCategory } from "../controllers/categoryController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", getCategories);

router.post("/create", authenticate, createCategory);

router.put("/:id", authenticate, updateCategory);

router.delete("/:id", authenticate, deleteCategory);

export default router;