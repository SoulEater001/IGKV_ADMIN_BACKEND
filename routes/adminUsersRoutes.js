import express from 'express'
import {authenticate, authorize} from '../middleware/authMiddleware.js'
import {getUsers, createUser, updateUser, deleteUser} from '../controllers/adminUsersController.js'
import { ROLES } from '../constant/index.js';
import { ROLE_GROUPS } from '../utils/approval.js';

const router = express.Router();

router.get("/", authenticate, getUsers);

router.post("/create", authenticate,authorize(...ROLE_GROUPS.ADMIN_PANEL), createUser);

router.put("/:id", authenticate,authorize(...ROLE_GROUPS.ADMIN_PANEL), updateUser);

router.delete("/:id", authenticate,authorize(...ROLE_GROUPS.ADMIN_PANEL), deleteUser);

export default router;
