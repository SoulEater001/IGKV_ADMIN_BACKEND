import express from "express";
import { getBlockById, getBlocksPaginated, updateBlock, createBlock, deleteBlock, getBlocks } from "../controllers/blockController.js";
import { authenticate, authorizePermissions } from '../middleware/authMiddleware.js'
import { PERMISSION_ACTIONS, PERMISSION_RESOURCES } from "../constant/index.js";

const router = express.Router();

router.use(authenticate);


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