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
    filters = {}
) => {

    let sql = `
        SELECT id
        FROM approval_requests
        WHERE
            resource = ?
            AND action = ?
            AND status = ?
    `;

    const params = [
        resource,
        action,
        APPROVAL_STATUS.PENDING
    ];

    for (const [key, value] of Object.entries(filters)) {

        sql += `
            AND JSON_UNQUOTE(JSON_EXTRACT(payload, ?)) = ?
        `;

        params.push(`$.${key}`, String(value));

    }

    sql += ` LIMIT 1`;

    const [[row]] = await connection.query(sql, params);

    return !!row;
};