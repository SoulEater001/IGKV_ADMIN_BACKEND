import express from 'express'
import { createAdvisory, getAdvisoriesPaginated, createBulkAdvisories, loadPreviousAdvisories, getPreviousAdvisoryOptions, createAdvisoryMain, submitAdvisoryWizard } from '../controllers/advisoryController.js';
import { updateAdvisory, deleteAdvisory } from '../controllers/advisoryController.js';
import { authenticate, authorizePermissions } from '../middleware/authMiddleware.js'
import { PERMISSION_RESOURCES, PERMISSION_ACTIONS } from '../constant/index.js';

const router = express.Router();

router.use(authenticate)


router.post(
    "/main/create",
    createAdvisoryMain
);

router.get(
    "/paginated",
    authorizePermissions(
        PERMISSION_RESOURCES.ADVISORIES,
        PERMISSION_ACTIONS.READ
    ),
    getAdvisoriesPaginated
);

router.get(
    '/previous/options',
    authorizePermissions(
        PERMISSION_RESOURCES.ADVISORIES,
        PERMISSION_ACTIONS.READ
    ),
    getPreviousAdvisoryOptions
);


router.get(
    '/previous/load',
    authorizePermissions(
        PERMISSION_RESOURCES.ADVISORIES,
        PERMISSION_ACTIONS.READ
    ),
    loadPreviousAdvisories
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

router.post("/wizard/submit", submitAdvisoryWizard);

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