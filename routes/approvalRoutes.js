import express from "express"
import { authenticate, authorizePermissions } from "../middleware/authMiddleware.js";
import { getApprovalRequests, approveRequest, rejectRequest } from "../controllers/approvalController.js";
import { PERMISSION_ACTIONS, PERMISSION_RESOURCES } from "../constant/index.js";

const router = express.Router();

router.use(authenticate);


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