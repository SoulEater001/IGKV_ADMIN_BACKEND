import express from "express";
import { getBlockById, getBlocksPaginated, updateBlock, createBlock, deleteBlock, getBlocks } from "../controllers/blockController.js";
import { authenticate, authorize, authorizePermissions } from '../middleware/authMiddleware.js'
import { PERMISSION_ACTIONS, PERMISSION_RESOURCES } from "../constant/index.js";
import { ROLE_GROUPS } from "../utils/approval.js";

const router = express.Router();

router.use(authenticate);
router.use(authorize(...ROLE_GROUPS.ADMIN_PANEL));

router.get("/", 
    authorizePermissions(
        PERMISSION_RESOURCES.BLOCK, 
        PERMISSION_ACTIONS.READ
    ),
    getBlocks

); 
router.get("/paginated",
    authorizePermissions(
        PERMISSION_RESOURCES.BLOCK, 
        PERMISSION_ACTIONS.READ
    ),
    getBlocksPaginated
);

router.get("/:id",
    authorizePermissions(
        PERMISSION_RESOURCES.BLOCK,
        PERMISSION_ACTIONS.READ
    ),
    getBlockById
);

router.post(
    "/create",
    authorizePermissions(
        PERMISSION_RESOURCES.BLOCK,
        PERMISSION_ACTIONS.CREATE
    ),
    createBlock
);

router.put(
    "/:id",
    authorizePermissions(
        PERMISSION_RESOURCES.BLOCK,
        PERMISSION_ACTIONS.UPDATE
    ),
    updateBlock
);

router.delete(
    "/:id",
    authorizePermissions(
        PERMISSION_RESOURCES.BLOCK,
        PERMISSION_ACTIONS.DELETE
    ),
    deleteBlock
);

export default router;