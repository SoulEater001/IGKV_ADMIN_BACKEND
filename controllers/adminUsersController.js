import { pool } from "../config/db.js";
import bcrypt from 'bcrypt'
import { logActivity } from "../utils/activityLogger.js";
import { ACTIONS } from "../constant/activityActions.js";
import { ENTITIES } from "../constant/activityEntities.js";
import { createApprovalRequest, hasPendingApproval } from "../services/approvalService.js";
import { executeCreateUser, executeDeleteUser, executeUpdateUser } from "../services/adminUserService.js";
import { requiresApproval, canManageUser } from "../utils/approval.js";

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
                 AND r.is_active = 1

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

        const normalizedRoleIds = [
            ...new Set(
                role_ids.map(Number)
            )
        ];

        if (
            normalizedRoleIds.some(
                roleId => !Number.isInteger(roleId) || roleId <= 0
            )
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Invalid role ID."
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
                AND is_active = 1
        `,
            [normalizedRoleIds]
        );

        if (roles.length !== normalizedRoleIds.length) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: "Roles not found."
            });
        }

        const allowed = await canManageUser(
            connection,
            req.user.id,
            roles.map(role => role.id)
        );

        if (!allowed) {
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
            role_ids: normalizedRoleIds,
            is_active
        };

        if (await requiresApproval(connection, req.user.id)) {

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
                entityId: null,
                description: `${req.user.name} requested creation of user ${name.trim()}`,
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

        const userId = Number(req.params.id);

        if (!Number.isInteger(userId) || userId <= 0) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Invalid user ID."
            });
        }

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

        const normalizedRoleIds = [
            ...new Set(
                role_ids.map(Number)
            )
        ];

        if (
            normalizedRoleIds.some(
                roleId => !Number.isInteger(roleId) || roleId <= 0
            )
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Invalid role ID."
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
            [userId]
        );

        if (!user) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        if (userId === req.user.id) {
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
            [userId]
        );

        const allowed = await canManageUser(
            connection,
            req.user.id,
            existingRoles.map(role => role.role_id)
        );

        if (!allowed) {
            await connection.rollback();

            return res.status(403).json({
                success: false,
                message: "You are not allowed to modify this user."
            });
        }

        const currentRoleIds = existingRoles
            .map(role => Number(role.role_id))
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
                userId
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
            SELECT
                id,
                name
            FROM roles
            WHERE id IN (?)
              AND is_active = 1
            `,
            [normalizedRoleIds]
        );

        if (roles.length !== normalizedRoleIds.length) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "One or more roles were not found or are inactive."
            });
        }

        const canManageNewRoles = await canManageUser(
            connection,
            req.user.id,
            roles.map(role => role.id)
        );

        if (!canManageNewRoles) {
            await connection.rollback();

            return res.status(403).json({
                success: false,
                message: "You are not allowed to assign one or more selected roles."
            });
        }

        const userData = {
            id: userId,
            name: name.trim(),
            email: email.trim(),
            role_ids: normalizedRoleIds,
            is_active,
            password: password?.trim()
                ? await bcrypt.hash(password, 10)
                : null,
            currentRoleIds,
            previousIsActive: Boolean(user.is_active)
        };

        if (await requiresApproval(connection, req.user.id)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.USER,
                ACTIONS.UPDATE,
                {
                    id: userId
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
                recordId: userId,
                payload: userData,
                requestedBy: req.user.id
            });

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.UPDATE,
                entity: ENTITIES.USER,
                entityId: userId,
                description: `${req.user.name} requested update of user ${name.trim()}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message: "User update request sent for approval."
            });
        }

        await executeUpdateUser(
            connection,
            userData
        );

        await connection.commit();

        await logActivity({
            userId: req.user.id,
            action: ACTIONS.UPDATE,
            entity: ENTITIES.USER,
            entityId: userId,
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
        await connection.beginTransaction();

        const userId = Number(req.params.id);

        if (!Number.isInteger(userId) || userId <= 0) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Invalid user ID."
            });
        }

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
            [userId]
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
                .filter(row => row.role_id)
                .map(row => ({
                    id: row.role_id,
                    name: row.role_name
                }))
        };

        if (userId === req.user.id) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "You cannot delete your own account."
            });
        }

        const allowed = await canManageUser(
            connection,
            req.user.id,
            user.roles.map(role => role.id)
        );

        if (!allowed) {
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

        if (await requiresApproval(connection, req.user.id)) {

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
        }

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

    } catch (error) {
        await connection.rollback();

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete user."
        });

    } finally {
        connection.release();
    }
};