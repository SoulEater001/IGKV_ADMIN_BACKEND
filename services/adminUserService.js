
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

    await connection.query(
        `
        INSERT INTO user_roles
        (
            user_id,
            role_id
        )
        VALUES (?, ?)
        `,
        [
            result.insertId,
            data.role_id
        ]
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