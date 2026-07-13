import { APPROVAL_STATUS } from "../constant/index.js";

export const createApprovalRequest = async (
    connection,
    {
        resource,
        action,
        recordId = null,
        payload,
        requestedBy
    }
) => {

    await connection.query(
        `
        INSERT INTO approval_requests
        (
            resource,
            action,
            status,
            record_id,
            payload,
            requested_by
        )
        VALUES (?, ?,?, ?, ?, ?)
        `,
        [
            resource,
            action,
            APPROVAL_STATUS.PENDING,
            recordId,
            JSON.stringify(payload),
            requestedBy
        ]
    );

};

export const hasPendingApproval = async (
    connection,
    resource,
    action,
    jsonPath,
    value
) => {

    const [[row]] = await connection.query(
        `
        SELECT id
        FROM approval_requests
        WHERE
            resource = ?
            AND action = ?
            AND status = ?
            AND JSON_UNQUOTE(JSON_EXTRACT(payload, ?)) = ?
        LIMIT 1
        `,
        [
            resource,
            action,
            APPROVAL_STATUS.PENDING,
            `$.${jsonPath}`,
            value
        ]
    );

    return !!row;
};