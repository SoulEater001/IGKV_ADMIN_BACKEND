import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt.js";
import { logActivity } from "../utils/activityLogger.js";

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

        const [roleRows] = await pool.query(
            `
    SELECT r.name AS role
    FROM user_roles ur
    JOIN roles r
        ON ur.role_id = r.id
    WHERE ur.user_id = ?
    `,
            [user.id]
        );

        const role = roleRows[0]?.role;

        const payload = {
            id: user.id,
            name: user.name,
            email: user.email,
            role,
        };

        const accessToken = generateAccessToken(payload);

        // const refreshToken = generateRefreshToken(payload);

        const userResponse = {
            id: user.id,
            name: user.name,
            email: user.email,
            role,
        };

        await logActivity({
            userId: user.id,
            action: "LOGIN",
            entity: "Admin_User",
            entityId: user.id,
            description: `${user.name} logged in`,
            ipAddress: req.ip
        });

        return res.status(200).json({
            success: true,
            message: "Login successful.",
            accessToken,
            // refreshToken,
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

export const logout = async (req, res) => {

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

};