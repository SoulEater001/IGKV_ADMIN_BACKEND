import { invalidateRoleUsers } from "../utils/token.js";

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

export const executeUpdateRole = async (
    connection,
    roleData
) => {

    await connection.query(
        `
        UPDATE roles
        SET
            name = ?,
            description = ?
        WHERE id = ?
        `,
        [
            roleData.name,
            roleData.description,
            roleData.id
        ]
    );

    await connection.query(
        `
        DELETE FROM role_permissions
        WHERE role_id = ?
        `,
        [roleData.id]
    );

    if (roleData.permissionIds.length > 0) {

        const values = roleData.permissionIds.map(permissionId => [
            roleData.id,
            permissionId
        ]);

        await connection.query(
            `
            INSERT INTO role_permissions
            (
                role_id,
                permission_id
            )
            VALUES ?
            `,
            [values]
        );

    }

    await invalidateRoleUsers(
        connection,
        roleData.id
    );

    return roleData.id;

};