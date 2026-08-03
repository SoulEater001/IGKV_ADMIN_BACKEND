import express from "express"
import { getCategories, createCategory, updateCategory, deleteCategory } from "../controllers/categoryController.js";
import { authenticate, authorize, authorizePermissions } from "../middleware/authMiddleware.js";
import { PERMISSION_ACTIONS, PERMISSION_RESOURCES } from "../constant/index.js";
import { ROLE_GROUPS } from "../utils/approval.js";

const router = express.Router();

router.use(authenticate);
router.use(authorize(...ROLE_GROUPS.ADMIN_PANEL));

router.get(
    "/",
    authorizePermissions(PERMISSION_RESOURCES.CATEGORIES, PERMISSION_ACTIONS.READ),
    getCategories
);

router.post(
    "/create",
    authorizePermissions(
        PERMISSION_RESOURCES.CATEGORIES,
        PERMISSION_ACTIONS.CREATE
    ),
    createCategory
);

router.put(
    "/:id",
    authorizePermissions(
        PERMISSION_RESOURCES.CATEGORIES,
        PERMISSION_ACTIONS.UPDATE
    ),
    updateCategory
);

router.delete(
    "/:id",
    authorizePermissions(
        PERMISSION_RESOURCES.CATEGORIES,
        PERMISSION_ACTIONS.DELETE
    ),
    deleteCategory
);


export default router;