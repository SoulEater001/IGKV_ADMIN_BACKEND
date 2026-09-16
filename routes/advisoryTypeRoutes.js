import express from "express";
import { getAdvisoryTypes, createAdvisoryType, updateAdvisoryType, deleteAdvisoryType } from '../controllers/advisoryTypeController.js';
import { authenticate, authorizePermissions } from '../middleware/authMiddleware.js'
import { PERMISSION_RESOURCES, PERMISSION_ACTIONS } from '../constant/index.js';


const router = express.Router();


router.use(authenticate)

router.get(
    "",
    authorizePermissions(
        PERMISSION_RESOURCES.ADVISORY_TYPES,
        PERMISSION_ACTIONS.READ
    ),
    getAdvisoryTypes
);

router.post(
    "/create",
    authorizePermissions(
        PERMISSION_RESOURCES.ADVISORY_TYPES,
        PERMISSION_ACTIONS.CREATE
    ),
    createAdvisoryType
);

router.put(
    "/:id",
    authorizePermissions(
        PERMISSION_RESOURCES.ADVISORY_TYPES,
        PERMISSION_ACTIONS.UPDATE
    ),
    updateAdvisoryType
);

router.delete(
    "/:id",
    authorizePermissions(
        PERMISSION_RESOURCES.ADVISORY_TYPES,
        PERMISSION_ACTIONS.DELETE
    ),
    deleteAdvisoryType
);


export default router;