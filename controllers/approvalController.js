import { pool } from "../config/db.js";

import { ACTIONS } from "../constant/activityActions.js";
import { APPROVAL_STATUS } from "../constant/index.js";
import { logActivity } from "../utils/activityLogger.js";
import { executeApprovedRequest } from "../services/approvalExecutionService.js";

export const getApprovalRequests = async (req, res) => {
    try {

        const [rows] = await pool.query(
            `
            SELECT
                ar.id,
                ar.resource,
                ar.action,
                ar.record_id,
                ar.payload,
                ar.status,
                ar.remarks,
                ar.requested_at,

                u.name AS requested_by_name,
                u.email AS requested_by_email

            FROM approval_requests ar

            LEFT JOIN admin_users u
                ON ar.requested_by = u.id

            WHERE ar.status =?

            ORDER BY ar.requested_at ASC
            `, [APPROVAL_STATUS.PENDING]
        );

        const sanitizedRows = rows.map((row) => {

            const payload =
                typeof row.payload === "string"
                    ? JSON.parse(row.payload)
                    : row.payload;

            delete payload.password;

            return {
                ...row,
                payload
            };

        });

        return res.status(200).json({
            success: true,
            data: sanitizedRows,
            count: sanitizedRows.length
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch approval requests."
        });

    }
};


export const approveRequest = async (req, res) => {
    const { remarks } = req.body;

    const connection = await pool.getConnection();
    let request;
    try {

        await connection.beginTransaction();

        [[request]] = await connection.query(
            `
            SELECT *
            FROM approval_requests
            WHERE id = ?
            FOR UPDATE
            `,
            [req.params.id]
        );

        if (!request) {

            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Approval request not found."
            });

        }

        if (request.status !== APPROVAL_STATUS.PENDING) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Approval request already processed."
            });

        }

        const payload =
            typeof request.payload === "string"
                ? JSON.parse(request.payload)
                : request.payload;

        const entityId = await executeApprovedRequest(
            connection,
            request,
            payload
        );

        await connection.query(
            `
            UPDATE approval_requests
            SET
                status = ?,
                approved_by = ?,
                approved_at = NOW(),
                remarks = ?,
                record_id = ?
            WHERE id = ?
            `,
            [
                APPROVAL_STATUS.APPROVED,
                req.user.id,
                remarks ?? null,
                entityId,
                request.id,
            ]
        );

        await connection.commit();

        await logActivity({
            userId: req.user.id,
            action: ACTIONS.APPROVE,
            entity: request.resource,
            entityId: entityId ?? request.record_id,
            description: `${req.user.name} approved ${request.resource} ${request.action}`,
            ipAddress: req.ip
        });

        return res.status(200).json({
            success: true,
            message: "Request approved successfully."
        });

    } catch (error) {

        await connection.rollback();

        console.error(error);
        if (request?.id) {

            await pool.query(
                `
            UPDATE approval_requests
            SET
                status = ?,
                 approved_by = ?,
                approved_at = NOW(),
                remarks = ?
            WHERE id = ?
            `,
                [
                    APPROVAL_STATUS.REJECTED,
                    req.user.id,
                    error.message ?? remarks ?? null,
                    request.id
                ]
            );

        }

        return res.status(500).json({
            success: false,
            message: error.message || "Failed to approve request."
        });

    } finally {

        connection.release();

    }

};

export const rejectRequest = async (req, res) => {
    const connection = await pool.getConnection();
    let request;
    try {

        const { remarks } = req.body;
        await connection.beginTransaction();

        [[request]] = await connection.query(
            `
            SELECT *
            FROM approval_requests
            WHERE id = ?
            FOR UPDATE
            `,
            [req.params.id]
        );

        if (!request) {

            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Approval request not found."
            });

        }

        if (request.status !== APPROVAL_STATUS.PENDING) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Approval request already processed."
            });

        }

        const [update] = await connection.query(
            `
            UPDATE approval_requests
            SET
                status = ?,
                approved_by = ?,
                approved_at = NOW(),
                remarks = ?
            WHERE
                id = ?
                AND status = ?
            `,
            [
                APPROVAL_STATUS.REJECTED,
                req.user.id,
                remarks ?? null,
                req.params.id,
                APPROVAL_STATUS.PENDING,
            ]
        );

        if (!update.affectedRows) {
            return res.status(404).json({
                success: false,
                message: "Approval request not found."
            });
        }

        await connection.commit();

        await logActivity({
            userId: req.user.id,
            action: ACTIONS.REJECT,
            entity: request.resource,
            entityId: request.record_id,
            description: `${req.user.name} rejected ${request.resource} ${request.action}`,
            ipAddress: req.ip
        });

        return res.status(200).json({
            success: true,
            message: "Request rejected successfully."
        });

    } catch (error) {

        console.error(error);
        await connection.rollback();
        return res.status(500).json({
            success: false,
            message: "Failed to reject request."
        });

    } finally {
        connection.release();
    }

};