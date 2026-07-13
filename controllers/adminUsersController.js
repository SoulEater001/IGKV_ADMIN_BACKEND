import { pool } from "../config/db.js";
import bcrypt from 'bcrypt'
import { logActivity } from "../utils/activityLogger.js";
import { ACTIONS } from "../constant/activityActions.js";
import { ENTITIES } from "../constant/activityEntities.js";
import { createApprovalRequest, hasPendingApproval } from "../services/approvalService.js";
import { executeCreateUser, executeDeleteUser } from "../services/adminUserService.js";
import { ROLES } from "../constant/index.js";

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
                r.name AS role
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
            SELECT id, name
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
            SELECT id, name
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

        if (
            req.user.role === ROLES.ADMIN &&
            role.name === ROLES.SUPER_ADMIN
        ) {
            await connection.rollback();

            return res.status(403).json({
                success: false,
                message: "You are not allowed to create a Super Admin."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const userData = {
            name: name.trim(),
            email: email.trim(),
            password: hashedPassword,
            role_id,
            is_active
        };

        if (req.user.role === ROLES.ADMIN) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.USER,
                ACTIONS.CREATE,
                {
                    email: email.trim()
                }
            );

            if (pending) {
                await connection.rollback();
                return res.status(409).json({
                    success: false,
                    message: "A user creation request with this email is already pending."
                });
            }

            await createApprovalRequest(connection, {
                resource: ENTITIES.USER,
                action: ACTIONS.CREATE,
                payload: userData,
                requestedBy: req.user.id
            });

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.CREATE,
                entity: ENTITIES.USER,
                entityId: req.user.id,
                description: `${req.user.name} requested creation of user ${name}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message: "User creation request sent for approval."
            });

        } else {

            const userId = await executeCreateUser(connection, userData);

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.CREATE,
                entity: ENTITIES.USER,
                entityId: userId,
                description: `${req.user.name} created user ${name.trim()}`,
                ipAddress: req.ip
            });

            return res.status(201).json({
                success: true,
                message: "User created successfully."
            });
        }

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
            SELECT id, name
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

        await logActivity({
            userId: req.user.id,
            action: ACTIONS.UPDATE,
            entity: ENTITIES.USER,
            entityId: id,
            description: `${req.user.name} updated user ${name.trim()}`,
            ipAddress: req.ip
        });

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
    const connection = await pool.getConnection();
    try {

        const { id } = req.params;
        await connection.beginTransaction();
        const [[user]] = await connection.query(
            `
            SELECT
                u.id,
                u.name,
                u.email,
                r.name AS role
            FROM admin_users u
            LEFT JOIN user_roles ur
                ON u.id = ur.user_id
            LEFT JOIN roles r
                ON ur.role_id = r.id
            WHERE u.id = ?
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

        if (
            req.user.role === ROLES.ADMIN &&
            user.role === ROLES.SUPER_ADMIN
        ) {
            await connection.rollback();

            return res.status(403).json({
                success: false,
                message: "You cannot delete a Super Admin."
            });
        }

        if (req.user.id == Number(id)) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: "You cannot delete your own account."
            });
        }
        const payload = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        if (req.user.role === ROLES.ADMIN) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.USER,
                ACTIONS.DELETE,
                {
                    id:user.id
                }
            );

            if (pending) {
                await connection.rollback();
                return res.status(409).json({
                    success: false,
                    message: "A delete request for this user is already pending."
                });
            }

            await createApprovalRequest(connection, {
                resource: ENTITIES.USER,
                action: ACTIONS.DELETE,
                recordId: user.id,
                payload,
                requestedBy: req.user.id
            });

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.DELETE,
                entity: ENTITIES.USER,
                entityId: user.id,
                description: `${req.user.name} requested deletion of user ${user.name}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message: "User deletion request sent for approval."
            });

        } else {
            const deletedUserId = await executeDeleteUser(
                connection,
                user.id
            );
            await connection.commit();
            await logActivity({
                userId: req.user.id,
                action: ACTIONS.DELETE,
                entity: ENTITIES.USER,
                entityId: deletedUserId,
                description: `${req.user.name} deleted user ${user.name}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                message: "User deleted successfully."
            });
        }

    } catch (error) {

        console.error(error);
        await connection.rollback();
        return res.status(500).json({
            success: false,
            message: "Failed to delete user."
        });

    } finally {
        connection.release();
    }
};