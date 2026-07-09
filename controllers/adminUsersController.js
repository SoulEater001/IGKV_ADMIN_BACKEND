import { pool } from "../config/db.js";
import bcrypt from 'bcrypt'

export const getUsers = async (req, res) => {
    try {

        const [rows] = await pool.query(`
            SELECT
                u.id,
                 u.name,
                 u.email,
                 u.is_active,
                 u.created_at,
                 u.updated_at,

                r.id AS role_id,
                r.name AS role_name
           FROM admin_users u

            LEFT JOIN user_roles ur
                 ON u.id = ur.user_id

            LEFT JOIN roles r
                 ON ur.role_id = r.id

            ORDER BY u.id ASC;
        `);

        return res.status(200).json({
            success: true,
            data: rows,
            count: rows.length
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch users."
        });

    }
};

export const createUser = async (req, res) => {
    const connection = await pool.getConnection();

    try {

        await connection.beginTransaction();

        const {
            name,
            email,
            password,
            role_id,
            is_active = true
        } = req.body;

        if (
            !name?.trim() ||
            !email?.trim() ||
            !password?.trim() ||
            !role_id
        ) {
            return res.status(400).json({
                success: false,
                message: "Name, email, password and role are required."
            });
        }

        const [[existing]] = await connection.query(
            `
            SELECT id
            FROM admin_users
            WHERE email = ?
            `,
            [email.trim()]
        );

        if (existing) {
            return res.status(409).json({
                success: false,
                message: "Email already exists."
            });
        }

        const [[role]] = await connection.query(
            `
            SELECT id
            FROM roles
            WHERE id = ?
            `,
            [role_id]
        );

        if (!role) {
            return res.status(404).json({
                success: false,
                message: "Role not found."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

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
                name.trim(),
                email.trim(),
                hashedPassword,
                is_active ? 1 : 0
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
                role_id
            ]
        );

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: "User created successfully."
        });

    } catch (error) {

        await connection.rollback();

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to create user."
        });

    } finally {

        connection.release();

    }
};

export const updateUser = async (req, res) => {
    const connection = await pool.getConnection();

    try {

        await connection.beginTransaction();

        const { id } = req.params;

        const {
            name,
            email,
            password,
            role_id,
            is_active
        } = req.body;

        const [[user]] = await connection.query(
            `
            SELECT id
            FROM admin_users
            WHERE id = ?
            `,
            [id]
        );

        if (!user) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const [[emailUser]] = await connection.query(
            `
            SELECT id
            FROM admin_users
            WHERE email = ?
              AND id <> ?
            `,
            [
                email.trim(),
                id
            ]
        );

        if (emailUser) {

            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: "Email already exists."
            });
        }

        const [[role]] = await connection.query(
            `
            SELECT id
            FROM roles
            WHERE id = ?
            `,
            [role_id]
        );

        if (!role) {

            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Role not found."
            });
        }

        let sql = `
            UPDATE admin_users
            SET
                name = ?,
                email = ?,
                is_active = ?
        `;

        const params = [
            name.trim(),
            email.trim(),
            is_active ? 1 : 0
        ];

        if (password?.trim()) {

            sql += `, password = ?`;

            params.push(await bcrypt.hash(password, 10));

        }

        sql += ` WHERE id = ?`;

        params.push(id);

        await connection.query(sql, params);

        // Update role assignment
        await connection.query(
            `
            DELETE FROM user_roles
            WHERE user_id = ?
            `,
            [id]
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
                id,
                role_id
            ]
        );

        await connection.commit();

        return res.status(200).json({
            success: true,
            message: "User updated successfully."
        });

    } catch (error) {

        await connection.rollback();

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to update user."
        });

    } finally {

        connection.release();

    }
};

export const deleteUser = async (req, res) => {
    try {

        const { id } = req.params;

        if (req.user.id == id) {
            return res.status(400).json({
                success: false,
                message: "You cannot delete your own account."
            });
        }

        const [result] = await pool.query(
            `
            DELETE FROM admin_users
            WHERE id = ?
            `,
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "User deleted successfully."
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete user."
        });

    }
};