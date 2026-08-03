import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import { getAuthenticatedUser } from '../utils/authUser.js'

export const authenticate = async (req, res, next) => {
    const connection = await pool.getConnection();
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

        if (decoded.type !== "access") {
            return res.status(401).json({
                success: false,
                message: "Invalid token."
            });
        }

        const user = await getAuthenticatedUser(connection, decoded.id);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found."
            });
        }

        if (user.tokenVersion !== decoded.tokenVersion) {
            return res.status(401).json({
                success: false,
                message: "Session expired. Please login again."
            });
        }

        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: "Account is inactive."
            });
        }

        req.user = user;
        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token."
        });

    } finally {
        connection.release();
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

export const authorizePermissions = (resource, action) => (req, res, next) => {
    const permission = `${resource}:${action}`;

    if (!req.user.permissions.includes(permission)) {
        return res.status(403).json({
            success: false,
            message: "Forbidden"
        });
    }

    next();
};