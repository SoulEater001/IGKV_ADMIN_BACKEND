import express from "express"
import { getCategories, getCategoriesPaginated, createCategory, updateCategory, deleteCategory } from "../controllers/categoryController.js";
import { authenticate, authorizePermissions } from "../middleware/authMiddleware.js";
import { PERMISSION_ACTIONS, PERMISSION_RESOURCES } from "../constant/index.js";

const router = express.Router();

router.use(authenticate);


router.get(
    "/",
    authorizePermissions(PERMISSION_RESOURCES.CATEGORIES, PERMISSION_ACTIONS.READ),
    getCategories
);

router.get(
    "/paginated",
    authorizePermissions(PERMISSION_RESOURCES.CATEGORIES, PERMISSION_ACTIONS.READ),
    getCategoriesPaginated
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