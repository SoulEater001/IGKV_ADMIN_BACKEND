import express from 'express'
import { createAdvisory, getAdvisoriesPaginated, getAdvisoryTypes, createAdvisoryType, updateAdvisoryType, deleteAdvisoryType } from '../controllers/advisoryController.js';
import { updateAdvisory, deleteAdvisory } from '../controllers/advisoryController.js';
import { authenticate, authorize, authorizePermissions } from '../middleware/authMiddleware.js'
import { ROLE_GROUPS } from '../utils/approval.js';
import { PERMISSION_RESOURCES, PERMISSION_ACTIONS } from '../constant/index.js';

const router = express.Router();

router.use(authenticate)
router.use(authorize(...ROLE_GROUPS.ADMIN_PANEL))

router.get(
    "/types",
    authorizePermissions(
        PERMISSION_RESOURCES.ADVISORY_TYPES,
        PERMISSION_ACTIONS.READ
    ),
    getAdvisoryTypes
);

router.get(
    "/paginated",
    authorizePermissions(
        PERMISSION_RESOURCES.ADVISORIES,
        PERMISSION_ACTIONS.READ
    ),
    getAdvisoriesPaginated
);

router.post(
    "/types/create",
    authorizePermissions(
        PERMISSION_RESOURCES.ADVISORY_TYPES,
        PERMISSION_ACTIONS.CREATE
    ),
    createAdvisoryType
);

router.put(
    "/types/:id",
    authorizePermissions(
        PERMISSION_RESOURCES.ADVISORY_TYPES,
        PERMISSION_ACTIONS.UPDATE
    ),
    updateAdvisoryType
);

router.delete(
    "/types/:id",
    authorizePermissions(
        PERMISSION_RESOURCES.ADVISORY_TYPES,
        PERMISSION_ACTIONS.DELETE
    ),
    deleteAdvisoryType
);

router.post(
    "/create",
    authorizePermissions(
        PERMISSION_RESOURCES.ADVISORIES,
        PERMISSION_ACTIONS.CREATE
    ),
    createAdvisory
);

router.put(
    "/:id",
    authorizePermissions(
        PERMISSION_RESOURCES.ADVISORIES,
        PERMISSION_ACTIONS.UPDATE
    ),
    updateAdvisory
);

router.delete(
    "/:id",
    authorizePermissions(
        PERMISSION_RESOURCES.ADVISORIES,
        PERMISSION_ACTIONS.DELETE
    ),
    deleteAdvisory
);

export default router;