import { pool } from "../config/db.js";

export const getDashboardStats = async (req, res) => {
    try {

        const [
            [[adminUsers]],
            [[roles]],
            [[permissions]],
            [[categories]],
            [[advisoryTypes]],
            [[crops]],
            [[zones]],
            [[states]],
            [[districts]],
            [[blocks]],
            [[advisories]]
        ] = await Promise.all([

            pool.query(`
                SELECT COUNT(*) AS total
                FROM admin_users
                WHERE is_active = 1
            `),

            pool.query(`
                SELECT COUNT(*) AS total
                FROM roles
            `),

            pool.query(`
                SELECT COUNT(*) AS total
                FROM permissions
            `),

            pool.query(`
                SELECT COUNT(*) AS total
                FROM imd_m_category
            `),

            pool.query(`
                SELECT COUNT(*) AS total
                FROM imd_advisory_type
            `),

            pool.query(`
                SELECT COUNT(*) AS total
                FROM imd_m_crop
            `),

            pool.query(`
                SELECT COUNT(*) AS total
                FROM m_zone
                WHERE deleted IS NULL
            `),

            pool.query(`
                SELECT COUNT(*) AS total
                FROM m_state
                WHERE deleted IS NULL
            `),

            pool.query(`
                SELECT COUNT(*) AS total
                FROM m_district
                WHERE deleted IS NULL
            `),

            pool.query(`
                SELECT COUNT(*) AS total
                FROM m_block
                WHERE deleted IS NULL
            `),

            pool.query(`
                SELECT COUNT(*) AS total
                FROM imd_advisory_detail
            `)

        ]);

        return res.json({
            success: true,
            data: {
                adminUsers: adminUsers.total,
                roles: roles.total,
                permissions: permissions.total,
                categories: categories.total,
                advisoryTypes: advisoryTypes.total,
                crops: crops.total,
                zones: zones.total,
                states: states.total,
                districts: districts.total,
                blocks: blocks.total,
                advisories: advisories.total
            }
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to load dashboard statistics."
        });

    }
};