export const executeCreateRole = async (connection, data) => {

    const [[existing]] = await connection.query(
        `
        SELECT id
        FROM roles
        WHERE name = ?
        `,
        [data.name]
    );

    if (existing) {
        throw new Error("Role already exists.");
    }

    const [result] = await connection.query(
        `
        INSERT INTO roles
        (
            name,
            description
        )
        VALUES (?, ?)
        `,
        [
            data.name,
            data.description ?? null
        ]
    );

    return result.insertId;

};

export const executeDeleteRole = async (
    connection,
    roleId
) => {

    const [[usage]] = await connection.query(
        `
        SELECT COUNT(*) AS total
        FROM user_roles
        WHERE role_id = ?
        `,
        [roleId]
    );

    if (usage.total > 0) {
        throw new Error(
            "Cannot delete role because it is assigned to one or more users."
        );
    }

    const [result] = await connection.query(
        `
        DELETE FROM roles
        WHERE id = ?
        `,
        [roleId]
    );

    if (!result.affectedRows) {
        throw new Error("Role not found.");
    }

    return roleId;

};