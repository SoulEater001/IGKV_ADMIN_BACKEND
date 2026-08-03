import express from "express"
import { authenticate, authorize, authorizePermissions } from "../middleware/authMiddleware.js";
import { getApprovalRequests, approveRequest, rejectRequest } from "../controllers/approvalController.js";
import { ROLE_GROUPS, SYSTEM_ROLES } from "../utils/approval.js";
import { PERMISSION_ACTIONS, PERMISSION_RESOURCES } from "../constant/index.js";

const router = express.Router();

router.use(authenticate);
router.use(authorize(...ROLE_GROUPS.APPROVAL));

router.get(
    "/",
    authorizePermissions(
        PERMISSION_RESOURCES.APPROVALS,
        PERMISSION_ACTIONS.READ
    ),
    getApprovalRequests
);

router.post(
    "/:id/approve",
    authorizePermissions(
        PERMISSION_RESOURCES.APPROVALS,
        PERMISSION_ACTIONS.UPDATE
    ),
    approveRequest
);

router.post(
    "/:id/reject",
    authorizePermissions(
        PERMISSION_RESOURCES.APPROVALS,
        PERMISSION_ACTIONS.UPDATE
    ),
    rejectRequest
);

export default router;