import { pool } from "../config/db.js";

export const invalidateUserTokens = async (connection, userId) => {
    await connection.query(
        `
        UPDATE admin_users
        SET token_version = token_version + 1
        WHERE id = ?
        `,
        [userId]
    );
    await connection.query(
        `
        DELETE
        FROM refresh_tokens
        WHERE user_id = ?
        `,
        [userId]
    );
};

export const invalidateRoleUsers = async (connection, roleId) => {
    await connection.query(
        `
        UPDATE admin_users u

        JOIN user_roles ur
            ON u.id = ur.user_id

        SET u.token_version = u.token_version + 1

        WHERE ur.role_id = ?
        `,
        [roleId]
    );
    await connection.query(
        `
        DELETE rt
        FROM refresh_tokens rt

        JOIN user_roles ur
            ON rt.user_id = ur.user_id

        WHERE ur.role_id = ?
        `,
        [roleId]
    );
};