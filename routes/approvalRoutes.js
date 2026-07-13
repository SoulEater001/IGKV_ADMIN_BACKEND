import express from "express"
import { authenticate, authorize } from "../middleware/authMiddleware.js";
import { getApprovalRequests, approveRequest, rejectRequest } from "../controllers/approvalController.js";

const router = express.Router();

router.get(
    "/",
    authenticate,
    authorize("SUPER_ADMIN"),
    getApprovalRequests
);

router.post(
    "/:id/approve",
    authenticate,
    authorize("SUPER_ADMIN"),
    approveRequest
);

router.post(
    "/:id/reject",
    authenticate,
    authorize("SUPER_ADMIN"),
    rejectRequest
);

export default router;