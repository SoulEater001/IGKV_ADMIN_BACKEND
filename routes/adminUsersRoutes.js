import express from 'express'
import {authenticate} from '../middleware/authMiddleware.js'
import {getUsers, createUser, updateUser, deleteUser} from '../controllers/adminUsersController.js'

const router = express.Router();

router.get("/", authenticate, getUsers);

router.post("/create", authenticate, createUser);

router.put("/:id", authenticate, updateUser);

router.delete("/:id", authenticate, deleteUser);

export default router;
