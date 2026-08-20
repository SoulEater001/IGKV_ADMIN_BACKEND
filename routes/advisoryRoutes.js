import express from 'express'
import { createAdvisory, getAdvisoriesPaginated, createBulkAdvisories, getPreviousAdvisories, getPreviousAdvisoryByDetailId, loadPreviousAdvisories, getPreviousAdvisoryOptions } from '../controllers/advisoryController.js';
import { updateAdvisory, deleteAdvisory } from '../controllers/advisoryController.js';
import { authenticate, authorize, authorizePermissions } from '../middleware/authMiddleware.js'
import { ROLE_GROUPS } from '../utils/approval.js';
import { PERMISSION_RESOURCES, PERMISSION_ACTIONS } from '../constant/index.js';

const router = express.Router();

router.get(

    '/previous/options',

    getPreviousAdvisoryOptions

);


router.get(

    '/previous/load',

    loadPreviousAdvisories

);
router.use(authenticate)
router.use(authorize(...ROLE_GROUPS.ADMIN_PANEL))

router.get(
    "/paginated",
    authorizePermissions(
        PERMISSION_RESOURCES.ADVISORIES,
        PERMISSION_ACTIONS.READ
    ),
    getAdvisoriesPaginated
);

router.get(
    "/previous",
    authorizePermissions(
        PERMISSION_RESOURCES.ADVISORIES,
        PERMISSION_ACTIONS.READ
    ),
    getPreviousAdvisories
);

router.get(
    "/previous/:advisoryDetailId",
    authorizePermissions(
        PERMISSION_RESOURCES.ADVISORIES,
        PERMISSION_ACTIONS.READ
    ),
    getPreviousAdvisoryByDetailId
);

router.post(
    "/create",
    authorizePermissions(
        PERMISSION_RESOURCES.ADVISORIES,
        PERMISSION_ACTIONS.CREATE
    ),
    createAdvisory
);

router.post(
    "/bulk-create",
    authorizePermissions(
        PERMISSION_RESOURCES.ADVISORIES,
        PERMISSION_ACTIONS.CREATE
    ),
    createBulkAdvisories
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