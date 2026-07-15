import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";

export const authenticate = async (req, res, next) => {
    try {

        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Access denied. No token provided."
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_ACCESS_SECRET
        );

        const [userRows] = await pool.query(
            `
            SELECT
                u.id,
                u.name,
                u.email,
                u.token_version,

                r.name AS role

            FROM admin_users u

            LEFT JOIN user_roles ur
                ON u.id = ur.user_id

            LEFT JOIN roles r
                ON ur.role_id = r.id

            WHERE u.id = ?
            `,
            [decoded.id]
        );

        if (userRows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "User not found."
            });
        }

        const user = userRows[0];

        if (user.token_version !== decoded.tokenVersion) {
            return res.status(401).json({
                success: false,
                message: "Session expired. Please login again."
            });
        }

        const roles = userRows
            .map(row => row.role)
            .filter(Boolean);

        const [permissions] = await pool.query(
            `
            SELECT DISTINCT
                p.resource,
                p.action

            FROM user_roles ur

            JOIN role_permissions rp
                ON ur.role_id = rp.role_id

            JOIN permissions p
                ON rp.permission_id = p.id

            WHERE ur.user_id = ?
            `,
            [decoded.id]
        );

        const permissionNames = permissions.map(
            permission => `${permission.resource}:${permission.action}`
        );

        req.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            roles,
            permissions: permissionNames
        };

        next();

    } catch (error) {

        return res.status(401).json({
            success: false,
            message: "Invalid or expired token."
        });

    }
};

export const authorize = (...roles) => {
    return (req, res, next) => {

        const hasRole = req.user.roles.some(role =>
            roles.includes(role)
        );

        if (!hasRole) {
            return res.status(403).json({
                success: false,
                message: "Forbidden"
            });
        }

        next();
    };
};

export const authorizePermissions = (resource, action) => {
    return async (req, res, next) => {
        try {

            const hasPermission = req.user.permissions.some(
                permission =>
                    permission.resource === resource &&
                    permission.action === action
            );

            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    message: "Forbidden"
                });
            }

            next();

        } catch (error) {
            next(error);
        }
    };
};