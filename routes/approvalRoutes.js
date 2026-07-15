import express from "express"
import { authenticate, authorize } from "../middleware/authMiddleware.js";
import { getApprovalRequests, approveRequest, rejectRequest } from "../controllers/approvalController.js";
import { SYSTEM_ROLES } from "../utils/approval.js";

const router = express.Router();

router.get(
    "/",
    authenticate,
    authorize(...SYSTEM_ROLES),
    getApprovalRequests
);

router.post(
    "/:id/approve",
    authenticate,
    authorize(...SYSTEM_ROLES),
    approveRequest
);

router.post(
    "/:id/reject",
    authenticate,
    authorize(...SYSTEM_ROLES),
    rejectRequest
);

export default router;