import { invalidateUserTokens } from '../utils/token.js'


export const executeCreateUser = async (connection, data) => {


    const [[existing]] = await connection.query(
        `
    SELECT id
    FROM admin_users
    WHERE email = ?
    `,
        [data.email]
    );

    if (existing) {
        throw new Error("Email already exists.");
    }

    const [result] = await connection.query(
        `
        INSERT INTO admin_users
        (
            name,
            email,
            password,
            is_active
        )
        VALUES (?, ?, ?, ?)
        `,
        [
            data.name,
            data.email,
            data.password,
            data.is_active ? 1 : 0
        ]
    );

    const userId = result.insertId;
    const values = data.role_ids.map(roleId => [
        userId,
        roleId
    ]);

    await connection.query(
        `
    INSERT INTO user_roles
    (
        user_id,
        role_id
    )
    VALUES ?
    `,
        [values]
    );

    return result.insertId;

};

export const executeDeleteUser = async (connection, userId) => {

    const [result] = await connection.query(
        `
        DELETE FROM admin_users
        WHERE id = ?
        `,
        [userId]
    );

    if (!result.affectedRows) {
        throw new Error("User not found.");
    }

    return userId;

};

export const executeUpdateUser = async (
    connection,
    userData
) => {

    let sql = `
        UPDATE admin_users
        SET
            name = ?,
            email = ?,
            is_active = ?
    `;

    const params = [
        userData.name,
        userData.email,
        userData.is_active ? 1 : 0
    ];

    if (userData.password) {

        sql += `, password = ?`;

        params.push(userData.password);

    }

    sql += ` WHERE id = ?`;

    params.push(userData.id);

    await connection.query(sql, params);

    await connection.query(
        `
        DELETE FROM user_roles
        WHERE user_id = ?
        `,
        [userData.id]
    );

    const values = userData.role_ids.map(roleId => [
        userData.id,
        roleId
    ]);

    await connection.query(
        `
        INSERT INTO user_roles
        (
            user_id,
            role_id
        )
        VALUES ?
        `,
        [values]
    );

    const newRoleIds = [...userData.role_ids]
        .map(Number)
        .sort((a, b) => a - b);

    const rolesChanged =
        JSON.stringify(userData.currentRoleIds) !==
        JSON.stringify(newRoleIds);

    const authorizationChanged =
        rolesChanged ||
        Boolean(userData.previousIsActive) !== Boolean(userData.is_active);

    if (authorizationChanged) {

        await invalidateUserTokens(
            connection,
            userData.id
        );

    }

    return userData.id;

};