import express from 'express'
import {authenticate, authorize} from '../middleware/authMiddleware.js'
import {getUsers, createUser, updateUser, deleteUser} from '../controllers/adminUsersController.js'
import { ROLES } from '../constant/index.js';

const router = express.Router();

router.get("/", authenticate, getUsers);

router.post("/create", authenticate,authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN), createUser);

router.put("/:id", authenticate,authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN), updateUser);

router.delete("/:id", authenticate,authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN), deleteUser);

export default router;
