export const executeCreatePermission = async (
    connection,
    data
) => {

    const [[existing]] = await connection.query(
        `
        SELECT id
        FROM permissions
        WHERE
            resource = ?
            AND action = ?
        `,
        [
            data.resource,
            data.action
        ]
    );

    if (existing) {
        throw new Error("Permission already exists.");
    }

    const [result] = await connection.query(
        `
        INSERT INTO permissions
        (
            resource,
            action
        )
        VALUES (?, ?)
        `,
        [
            data.resource,
            data.action
        ]
    );

    return result.insertId;

};

export const executeDeletePermission = async (
    connection,
    permissionId
) => {

    const [[usage]] = await connection.query(
        `
        SELECT COUNT(*) AS total
        FROM role_permissions
        WHERE permission_id = ?
        `,
        [permissionId]
    );

    if (usage.total > 0) {
        throw new Error(
            "Cannot delete permission because it is assigned to one or more roles."
        );
    }

    const [result] = await connection.query(
        `
        DELETE FROM permissions
        WHERE id = ?
        `,
        [permissionId]
    );

    if (!result.affectedRows) {
        throw new Error("Permission not found.");
    }

    return permissionId;

};