import express from "express";
import { getState, getStateById, createState, updateState, deleteState, getStatesPaginated } from "../controllers/stateController.js";
import { authenticate, authorizePermissions } from "../middleware/authMiddleware.js";
import { PERMISSION_ACTIONS, PERMISSION_RESOURCES } from "../constant/index.js";

const router = express.Router();

router.use(authenticate);


router.get(
    "/",
    authorizePermissions(
        PERMISSION_RESOURCES.STATE,
        PERMISSION_ACTIONS.READ
    ),
    getState
);

router.get(
    "/paginated",
    authorizePermissions(
        PERMISSION_RESOURCES.STATE,
        PERMISSION_ACTIONS.READ
    ),
    getStatesPaginated
);

router.get(
    "/:id",
    authorizePermissions(
        PERMISSION_RESOURCES.STATE,
        PERMISSION_ACTIONS.READ
    ),
    getStateById
);

router.post(
    "/create",
    authorizePermissions(
        PERMISSION_RESOURCES.STATE,
        PERMISSION_ACTIONS.CREATE
    ),
    createState
);

router.put(
    "/:id",
    authorizePermissions(
        PERMISSION_RESOURCES.STATE,
        PERMISSION_ACTIONS.UPDATE
    ),
    updateState
);

router.delete(
    "/:id",
    authorizePermissions(
        PERMISSION_RESOURCES.STATE,
        PERMISSION_ACTIONS.DELETE
    ),
    deleteState
);

export default router;