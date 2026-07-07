import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { login, signup, me, logout } from "../controllers/authController.js";

const router = express.Router();

router.post("/auth/login", login);
router.post("/auth/signup", signup);


router.get("/auth/me", authenticate, me);
router.post("/auth/logout", authenticate, logout);

export default router;
