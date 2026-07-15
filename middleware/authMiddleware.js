import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";

export const authenticate = async(req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Access denied. No token provided."
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

        const [[user]] = await pool.query(
            `
                SELECT token_version
                FROM admin_users
                WHERE id = ?
            `,
            [decoded.id]
        );

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found."
            });
        }

        if (user.token_version !== decoded.tokenVersion) {
            return res.status(401).json({
                success: false,
                message: "Session expired. Please login again."
            });
        }

        req.user = decoded;

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

            const [permissions] = await pool.query(
                `
                SELECT
                    p.resource,
                    p.action

                FROM user_roles ur

                JOIN role_permissions rp
                    ON ur.role_id = rp.role_id

                JOIN permissions p
                    ON rp.permission_id = p.id

                WHERE ur.user_id = ?
                `,
                [req.user.id]
            );

            const hasPermission = permissions.some(
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