import { pool } from "../config/db.js";

export const getActivityLogsPaginated = async (req, res) => {
    try {

        const {
            page = 1,
            limit = 10,
            search = "",
            action = "",
            entity = "",
            userId = "",
            from = "",
            to = ""
        } = req.query;

        const pageNumber = Number(page);
        const pageSize = Number(limit);
        const offset = (pageNumber - 1) * pageSize;

        let where = "WHERE 1=1";

        const params = [];

        if (search.trim()) {

            where += `
                AND (
                    LOWER(au.name) LIKE LOWER(?)
                    OR LOWER(al.action) LIKE LOWER(?)
                    OR LOWER(al.entity) LIKE LOWER(?)
                    OR LOWER(al.description) LIKE LOWER(?)
                )
            `;

            const keyword = `%${search.trim()}%`;

            params.push(
                keyword,
                keyword,
                keyword,
                keyword
            );

        }

        if (action.trim()) {

            where += ` AND al.action = ?`;

            params.push(action);

        }

        if (entity.trim()) {

            where += ` AND al.entity = ?`;

            params.push(entity);

        }

        if (userId) {

            where += ` AND al.user_id = ?`;

            params.push(userId);

        }

        if (from) {

            where += ` AND DATE(al.created_at) >= ?`;

            params.push(from);

        }

        if (to) {

            where += ` AND DATE(al.created_at) <= ?`;

            params.push(to);

        }

        const [[countResult]] = await pool.query(
            `
            SELECT COUNT(*) AS total

            FROM activity_log al

            LEFT JOIN admin_users au
                ON au.id = al.user_id

            ${where}
            `,
            params
        );

        const [rows] = await pool.query(
            `
            SELECT
                al.id,
                al.user_id,
                au.name,
                al.action,
                al.entity,
                al.entity_id,
                al.description,
                al.ip_address,
                al.created_at

            FROM activity_log al

            LEFT JOIN admin_users au
                ON au.id = al.user_id

            ${where}

            ORDER BY al.created_at DESC

            LIMIT ?

            OFFSET ?
            `,
            [
                ...params,
                pageSize,
                offset
            ]
        );

        return res.status(200).json({
            success: true,
            data: rows,
            page: pageNumber,
            limit: pageSize,
            total: countResult.total,
            totalPages: Math.ceil(countResult.total / pageSize)
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch activity logs."
        });

    }
};