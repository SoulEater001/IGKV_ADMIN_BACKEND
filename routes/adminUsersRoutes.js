import express from 'express'
import { authenticate, authorizePermissions } from '../middleware/authMiddleware.js'
import { getUsers, createUser, updateUser, deleteUser } from '../controllers/adminUsersController.js'
import { PERMISSION_ACTIONS, PERMISSION_RESOURCES } from '../constant/index.js';

const router = express.Router();

router.use(authenticate);


router.get("/",
    authorizePermissions(PERMISSION_RESOURCES.USERS, PERMISSION_ACTIONS.READ),
    getUsers
);

router.post("/create",
    authorizePermissions(PERMISSION_RESOURCES.USERS, PERMISSION_ACTIONS.CREATE),
    createUser
);

router.put("/:id",
    authorizePermissions(PERMISSION_RESOURCES.USERS, PERMISSION_ACTIONS.UPDATE),
    updateUser
);

router.delete("/:id",
    authorizePermissions(PERMISSION_RESOURCES.USERS, PERMISSION_ACTIONS.DELETE),
    deleteUser
);

export default router;
