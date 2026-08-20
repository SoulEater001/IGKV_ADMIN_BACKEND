import { pool } from "../config/db.js";
import bcrypt from 'bcrypt'
import { logActivity } from "../utils/activityLogger.js";
import { ACTIONS } from "../constant/activityActions.js";
import { ENTITIES } from "../constant/activityEntities.js";
import { createApprovalRequest, hasPendingApproval } from "../services/approvalService.js";
import { executeCreateUser, executeDeleteUser, executeUpdateUser } from "../services/adminUserService.js";
import { ROLES } from "../constant/index.js";
import { requiresApproval, canManageUser } from "../utils/approval.js";
import { invalidateUserTokens } from '../utils/token.js'

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

                GROUP_CONCAT(
                    DISTINCT r.id
                    ORDER BY r.id
                    SEPARATOR ','
                ) AS role_ids,

           GROUP_CONCAT(
               DISTINCT r.name
                ORDER BY r.name
                SEPARATOR ','
            ) AS roles

           FROM admin_users u

            LEFT JOIN user_roles ur
                 ON u.id = ur.user_id

            LEFT JOIN roles r
                 ON ur.role_id = r.id

                 GROUP BY
                    u.id,
                    u.name,
                    u.email,
                    u.is_active,
                    u.created_at,
                    u.updated_at

            ORDER BY u.id ASC;
        `);
        const users = rows.map(user => ({
            ...user,
            role_ids: user.role_ids
                ? user.role_ids.split(",").map(Number)
                : [],
            roles: user.roles
                ? user.roles.split(",")
                : []
        }));

        return res.status(200).json({
            success: true,
            data: users,
            count: users.length
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
            role_ids,
            is_active = true
        } = req.body;

        if (
            !name?.trim() ||
            !email?.trim() ||
            !password?.trim() ||
            !Array.isArray(role_ids) ||
            role_ids.length === 0
        ) {
            await connection.rollback();
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
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: "Email already exists."
            });
        }

        const [roles] = await connection.query(
            `
            SELECT id, name
            FROM roles
            WHERE id IN (?)
        `,
            [role_ids]
        );

        if (roles.length !== role_ids.length) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: "Roles not found."
            });
        }

        if (!canManageUser(req.user, roles.map(r => r.name))) {

            await connection.rollback();

            return res.status(403).json({
                success: false,
                message: "You are not allowed to assign one or more selected roles."
            });

        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const userData = {
            name: name.trim(),
            email: email.trim(),
            password: hashedPassword,
            role_ids,
            is_active
        };

        if (requiresApproval(req.user)) {

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
            role_ids,
            is_active
        } = req.body;

        if (
            !name?.trim() ||
            !email?.trim() ||
            !Array.isArray(role_ids) ||
            role_ids.length === 0
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Name, email and at least one role are required."
            });
        }

        const [[user]] = await connection.query(
            `
    SELECT
    id,
    name,
    is_active
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

        if (Number(id) === req.user.id) {

            await connection.rollback();

            return res.status(403).json({
                success: false,
                message: "You cannot modify your own account."
            });

        }

        const [existingRoles] = await connection.query(
            `
    SELECT
        ur.role_id,
        r.name
    FROM user_roles ur
    JOIN roles r
        ON ur.role_id = r.id
    WHERE ur.user_id = ?
    `,
            [id]
        );

        if (!canManageUser(req.user, existingRoles.map(r => r.name))) {

            await connection.rollback();

            return res.status(403).json({
                success: false,
                message: "You are not allowed to modify this user."
            });

        }

        const currentRoleIds = existingRoles
            .map(r => Number(r.role_id))
            .sort((a, b) => a - b);

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

        const [roles] = await connection.query(
            `
    SELECT id,name
    FROM roles
    WHERE id IN (?)
    `,
            [role_ids]
        );

        if (roles.length !== role_ids.length) {

            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Role not found."
            });
        }

        const userData = {
            id: Number(id),
            name: name.trim(),
            email: email.trim(),
            role_ids,
            is_active,
            password: password?.trim()
                ? await bcrypt.hash(password, 10)
                : null,
            role_ids,
            is_active,
            currentRoleIds,
            previousIsActive: Boolean(user.is_active)
        };

        if (requiresApproval(req.user)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.USER,
                ACTIONS.UPDATE,
                {
                    id: Number(id)
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "An update request for this user is already pending."
                });

            }

            await createApprovalRequest(connection, {
                resource: ENTITIES.USER,
                action: ACTIONS.UPDATE,
                recordId: Number(id),
                payload: userData,
                requestedBy: req.user.id
            });

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.UPDATE,
                entity: ENTITIES.USER,
                entityId: Number(id),
                description: `${req.user.name} requested update of user ${name.trim()}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message: "User update request sent for approval."
            });

        } else {
            await executeUpdateUser(connection, userData);
            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.UPDATE,
                entity: ENTITIES.USER,
                entityId: Number(id),
                description: `${req.user.name} updated user ${name.trim()}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                message: "User updated successfully."
            });
        }
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
        const [rows] = await connection.query(
            `
            SELECT
                u.id,
                u.name,
                u.email,
                r.id AS role_id,
                r.name AS role_name
            FROM admin_users u
            LEFT JOIN user_roles ur
                ON u.id = ur.user_id
            LEFT JOIN roles r
                ON ur.role_id = r.id
            WHERE u.id = ?
            `,
            [id]
        );

        if (!rows.length) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const user = {
            id: rows[0].id,
            name: rows[0].name,
            email: rows[0].email,
            roles: rows
                .filter(r => r.role_id)
                .map(r => ({
                    id: r.role_id,
                    name: r.role_name
                }))
        };

        if (req.user.id == Number(id)) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: "You cannot delete your own account."
            });
        }

        if (!canManageUser(req.user, user.roles.map(r => r.name))) {

            await connection.rollback();

            return res.status(403).json({
                success: false,
                message: "You are not allowed to delete this user."
            });

        }

        const payload = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.roles
        };

        if (requiresApproval(req.user)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.USER,
                ACTIONS.DELETE,
                {
                    id: user.id
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