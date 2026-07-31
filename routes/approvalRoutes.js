import express from "express"
import { authenticate, authorize } from "../middleware/authMiddleware.js";
import { getApprovalRequests, approveRequest, rejectRequest } from "../controllers/approvalController.js";
import { ROLE_GROUPS, SYSTEM_ROLES } from "../utils/approval.js";

const router = express.Router();

router.get(
    "/",
    authenticate,
    authorize(...ROLE_GROUPS.APPROVAL),
    getApprovalRequests
);

router.post(
    "/:id/approve",
    authenticate,
    authorize(...ROLE_GROUPS.APPROVAL),
    approveRequest
);

router.post(
    "/:id/reject",
    authenticate,
    authorize(...ROLE_GROUPS.APPROVAL),
    rejectRequest
);

export default router;