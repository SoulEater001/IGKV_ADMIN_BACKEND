import jwt from "jsonwebtoken";
import ms from "ms";

export const ACCESS_TOKEN_MAX_AGE = ms(
    process.env.JWT_ACCESS_EXPIRES_IN
);

export const REFRESH_TOKEN_MAX_AGE = ms(
    process.env.JWT_REFRESH_EXPIRES_IN
);

export const REFRESH_COOKIE_OPTIONS = {
    httpOnly: true,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: REFRESH_TOKEN_MAX_AGE
};

export const generateAccessToken = (payload) => {
    return jwt.sign(
        {
            ...payload,
            type: "access"
        },
        process.env.JWT_ACCESS_SECRET,
        {
            expiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
        }
    );
};

export const generateRefreshToken = (payload) => {
    return jwt.sign(
        {
            ...payload,
            type: "refresh"
        },
        process.env.JWT_REFRESH_SECRET,
        {
            expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
        }
    );
};