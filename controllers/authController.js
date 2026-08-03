import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import { generateAccessToken, generateRefreshToken, REFRESH_TOKEN_MAX_AGE, REFRESH_COOKIE_OPTIONS } from "../utils/jwt.js";
import { logActivity } from "../utils/activityLogger.js";
import crypto from "crypto";
import { getAuthenticatedUser } from "../utils/authUser.js";

export const signup = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required."
            });
        }

        const [existingUser] = await pool.query(
            "SELECT id FROM admin_users WHERE email = ?",
            [email]
        );

        if (existingUser.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Email already exists."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await pool.query(
            "INSERT INTO admin_users(name, email, password) VALUES(?, ?, ?)",
            [name, email, hashedPassword]
        );

        return res.status(201).json({
            success: true,
            message: "User created successfully.",
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
};

export const login = async (req, res) => {
    try {

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const [users] = await pool.query(
            "SELECT * FROM admin_users WHERE email = ?",
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const user = users[0];

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: "Your account has been deactivated. Please contact the administrator."
            });
        }

        const isPasswordValid = await bcrypt.compare(
            password,
            user.password
        );

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const payload = {
            id: user.id,
            name: user.name,
            email: user.email,
            tokenVersion: user.token_version
        };

        const accessToken = generateAccessToken(payload);
        const refreshToken = generateRefreshToken(payload);
        const refreshTokenHash = crypto
            .createHash("sha256")
            .update(refreshToken)
            .digest("hex");

        const decoded = jwt.verify(
            refreshToken,
            process.env.JWT_REFRESH_SECRET
        );

        const expiresAt = new Date(decoded.exp * 1000);

        await pool.query(
            `
    INSERT INTO refresh_tokens
    (
        user_id,
        token_hash,
        expires_at
    )
    VALUES (?, ?, ?)
    `,
            [
                user.id,
                refreshTokenHash,
                expiresAt
            ]
        );

        const userResponse = {
            id: user.id,
            name: user.name,
            email: user.email,
            tokenVersion: user.token_version
        };

        await logActivity({
            userId: user.id,
            action: "LOGIN",
            entity: "Admin_User",
            entityId: user.id,
            description: `${user.name} logged in`,
            ipAddress: req.ip
        });

        res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);

        return res.status(200).json({
            success: true,
            accessToken,
            user: userResponse
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
        });
    }
};

export const me = async (req, res) => {
    try {

        return res.status(200).json({
            success: true,
            user: req.user
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
};

export const refresh = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        // console.log("Refresh endpoint called")
        await connection.beginTransaction();
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            await connection.rollback();
            res.clearCookie(
                "refreshToken",
                REFRESH_COOKIE_OPTIONS
            );
            return res.status(401).json({
                success: false,
                message: "Refresh token is required."
            });
        }

        // Verify JWT
        const decoded = jwt.verify(
            refreshToken,
            process.env.JWT_REFRESH_SECRET
        );
        if (decoded.type !== "refresh") {
            return res.status(401).json({
                success: false,
                message: "Invalid refresh token."
            });
        }

        // Hash refresh token
        const refreshTokenHash = crypto
            .createHash("sha256")
            .update(refreshToken)
            .digest("hex");

        // Find stored token
        const [[storedToken]] = await connection.query(
            `
            SELECT
                id,
                user_id,
                expires_at,
                revoked_at
            FROM refresh_tokens
            WHERE token_hash = ?
            `,
            [refreshTokenHash]
        );

        if (!storedToken) {
            await connection.rollback();
            res.clearCookie(
                "refreshToken",
                REFRESH_COOKIE_OPTIONS
            );
            return res.status(401).json({
                success: false,
                message: "Invalid refresh token."
            });
        }

        if (storedToken.revoked_at) {
            await connection.rollback();
            res.clearCookie(
                "refreshToken",
                REFRESH_COOKIE_OPTIONS
            );
            return res.status(401).json({
                success: false,
                message: "Refresh token has been revoked."
            });
        }

        if (new Date(storedToken.expires_at) < new Date()) {
            await connection.rollback();
            res.clearCookie(
                "refreshToken",
                REFRESH_COOKIE_OPTIONS
            );
            return res.status(401).json({
                success: false,
                message: "Refresh token has expired."
            });
        }

        const user = await getAuthenticatedUser(
            connection,
            storedToken.user_id
        );

        if (!user) {
            await connection.rollback();
            res.clearCookie(
                "refreshToken",
                REFRESH_COOKIE_OPTIONS
            );
            return res.status(401).json({
                success: false,
                message: "User not found."
            });
        }

        if (!user.isActive) {
            await connection.rollback();
            res.clearCookie(
                "refreshToken",
                REFRESH_COOKIE_OPTIONS
            );
            return res.status(403).json({
                success: false,
                message: "Account is inactive."
            });
        }

        if (user.tokenVersion !== decoded.tokenVersion) {
            await connection.rollback();
            res.clearCookie(
                "refreshToken",
                REFRESH_COOKIE_OPTIONS
            );
            return res.status(401).json({
                success: false,
                message: "Session expired. Please login again."
            });
        }

        // Rotate refresh token
        await connection.query(
            `
            DELETE
            FROM refresh_tokens
            WHERE id = ?
            `,
            [storedToken.id]
        );

        const payload = {
            id: user.id,
            name: user.name,
            email: user.email,
            tokenVersion: user.tokenVersion
        };

        const newAccessToken = generateAccessToken(payload);

        const newRefreshToken = generateRefreshToken(payload);

        const newRefreshTokenHash = crypto
            .createHash("sha256")
            .update(newRefreshToken)
            .digest("hex");

        res.cookie("refreshToken", newRefreshToken, REFRESH_COOKIE_OPTIONS);

        const { exp } = jwt.decode(newRefreshToken);

        await connection.query(
            `
            INSERT INTO refresh_tokens
            (
                user_id,
                token_hash,
                expires_at
            )
            VALUES (?, ?, ?)
            `,
            [
                user.id,
                newRefreshTokenHash,
                new Date(exp * 1000)
            ]
        );
        await connection.commit();

        return res.status(200).json({
            success: true,
            accessToken: newAccessToken,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                roles: user.roles,
                permissions: user.permissions
            }
        });

    } catch (error) {
        await connection.rollback();
        res.clearCookie(
            "refreshToken",
            REFRESH_COOKIE_OPTIONS
        );
        return res.status(401).json({
            success: false,
            // message: error.message
            message: "Invalid or expired refresh token."
        });

    } finally {
        connection.release();
    }
};

export const logout = async (req, res) => {
    try {

        const refreshToken = req.cookies.refreshToken;

        if (refreshToken) {

            const refreshTokenHash = crypto
                .createHash("sha256")
                .update(refreshToken)
                .digest("hex");

            await pool.query(
                `
                DELETE
                FROM refresh_tokens
                WHERE token_hash = ?
                `,
                [refreshTokenHash]
            );

        }

        res.clearCookie(
            "refreshToken",
            REFRESH_COOKIE_OPTIONS
        );

        await logActivity({
            userId: req.user.id,
            action: "LOGOUT",
            entity: "Admin_User",
            entityId: req.user.id,
            description: `${req.user.name} logged out`,
            ipAddress: req.ip
        });

        return res.status(200).json({
            success: true,
            message: "Logout successful."
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to logout."
        });

    }
};