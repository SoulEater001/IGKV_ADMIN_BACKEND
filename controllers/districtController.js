import { pool } from "../config/db.js";

export const getDistrictsByZone = async (req, res) => {
    try {
        const { zoneId } = req.query;

        if (!zoneId) {
            return res.status(400).json({
                success: false,
                message: "zoneId is required.",
            });
        }

        const [rows] = await pool.query(
            `
            SELECT
                district_id,
                name,
                state_id,
                district_lg_code
            FROM m_district
            WHERE zone_id = ?
              AND deleted IS NULL
            ORDER BY name ASC
            `,
            [zoneId]
        );

        return res.status(200).json({
            success: true,
            count: rows.length,
            data: rows,
        });
    } catch (error) {
        console.error("Error fetching districts:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch districts.",
        });
    }
};

export const getDistricts = async (req, res) => {
    try {

        const {
            page = 1,
            limit = 20,
        } = req.query;

        const pageNumber = Number(page);

        const pageSize = Number(limit);

        const offset = (pageNumber - 1) * pageSize;

        const search = req.query.search?.trim() || "";

        let where = `WHERE d.deleted IS NULL`;

        const params = [];

        if (search) {

            where += `
                AND (
                    LOWER(d.name) LIKE ?
                    OR LOWER(s.name) LIKE ?
                    OR LOWER(z.name) LIKE ?
                    OR CAST(d.district_lg_code AS CHAR) LIKE ?
                )
            `;

            const keyword = `%${search}%`;

            params.push(
                keyword,
                keyword,
                keyword,
                keyword
            );

        }

        const [[countResult]] = await pool.query(
            `
            SELECT COUNT(*) AS total

            FROM m_district d

            LEFT JOIN m_state s
                ON d.state_id = s.state_id

            LEFT JOIN m_zone z
                ON d.zone_id = z.Zone_id

            ${where}
            `,
            params
        );

        const [rows] = await pool.query(
            `
            SELECT
                d.district_id,
                d.name,
                d.district_lg_code,
                d.state_id,
                s.name AS state_name,
                d.zone_id,
                z.name AS zone_name,
                d.create_datetime

            FROM m_district d

            LEFT JOIN m_state s
                ON d.state_id = s.state_id

            LEFT JOIN m_zone z
                ON d.zone_id = z.Zone_id

            ${where}

            ORDER BY d.name ASC

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
            total:countResult.total,
            totalPages: Math.ceil(countResult.total / pageSize)
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({

            success: false,

            message: "Failed to fetch districts."

        });

    }
};

export const getDistrictOptions = async (req, res) => {
    try {

        const [rows] = await pool.query(`
            SELECT
                district_id,
                name
            FROM m_district
            WHERE deleted IS NULL
            ORDER BY name ASC
        `);

        return res.status(200).json({
            success: true,
            count: rows.length,
            data: rows
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch districts."
        });

    }
};

export const getDistrictById = async (req, res) => {
    try {

        const { id } = req.params;

        const [[district]] = await pool.query(
            `
            SELECT *
            FROM m_district
            WHERE district_id = ?
              AND deleted IS NULL
            `,
            [id]
        );

        if (!district) {
            return res.status(404).json({
                success: false,
                message: "District not found."
            });
        }

        return res.status(200).json({
            success: true,
            data: district
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch district."
        });

    }
};

export const createDistrict = async (req, res) => {
    try {

        const {
            name,
            state_id,
            zone_id,
            district_lg_code
        } = req.body;

        if (
            !name?.trim() ||
            !state_id ||
            !district_lg_code
        ) {
            return res.status(400).json({
                success: false,
                message: "Name, State, Zone and LG Code are required."
            });
        }

        const [[existing]] = await pool.query(
            `
            SELECT district_id

            FROM m_district

            WHERE
                (
                    LOWER(name)=LOWER(?)
                    OR district_lg_code=?
                )
            AND deleted IS NULL
            `,
            [
                name.trim(),
                district_lg_code
            ]
        );

        if (existing) {
            return res.status(409).json({
                success: false,
                message: "District already exists."
            });
        }

        await pool.query(
            `
            INSERT INTO m_district
            (
                name,
                state_id,
                zone_id,
                district_lg_code
            )
            VALUES (?, ?, ?, ?)
            `,
            [
                name.trim(),
                String(state_id),
                zone_id,
                district_lg_code
            ]
        );

        return res.status(201).json({
            success: true,
            message: "District created successfully."
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to create district."
        });

    }
};

export const updateDistrict = async (req, res) => {

    const connection = await pool.getConnection();

    try {

        await connection.beginTransaction();

        const { id } = req.params;

        const {
            name,
            state_id,
            zone_id,
            district_lg_code
        } = req.body;

        const [[district]] = await connection.query(
            `
            SELECT *
            FROM m_district
            WHERE district_id=?
            `,
            [id]
        );

        if (!district) {

            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "District not found."
            });

        }

        const [[existing]] = await connection.query(
            `
            SELECT district_id

            FROM m_district

            WHERE
                (
                    LOWER(name)=LOWER(?)
                    OR district_lg_code=?
                )
            AND district_id<>?
            AND deleted IS NULL
            `,
            [
                name.trim(),
                district_lg_code,
                id
            ]
        );

        if (existing) {

            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: "District already exists."
            });

        }

        const oldLgCode = district.district_lg_code;

        await connection.query(
            `
            UPDATE m_district
            SET
                name=?,
                state_id=?,
                zone_id=?,
                district_lg_code=?

            WHERE district_id=?
            `,
            [
                name.trim(),
                String(state_id),
                zone_id,
                district_lg_code,
                id
            ]
        );

        if (oldLgCode !== district_lg_code) {

            await connection.query(
                `
                UPDATE imd_advisory_main
                SET district_lg_code=?
                WHERE district_lg_code=?
                `,
                [
                    district_lg_code,
                    oldLgCode
                ]
            );

            await connection.query(
                `
                UPDATE imd_advisory_detail
                SET district_lg_code=?
                WHERE district_lg_code=?
                `,
                [
                    district_lg_code,
                    oldLgCode
                ]
            );

        }

        await connection.commit();

        return res.status(200).json({
            success: true,
            message: "District updated successfully."
        });

    } catch (error) {

        await connection.rollback();

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to update district."
        });

    } finally {

        connection.release();

    }

};

export const deleteDistrict = async (req, res) => {
    try {

        const { id } = req.params;

        const [[district]] = await pool.query(
            `
            SELECT
                district_id,
                district_lg_code

            FROM m_district

            WHERE district_id=?
            `,
            [id]
        );

        if (!district) {
            return res.status(404).json({
                success: false,
                message: "District not found."
            });
        }

        const [[blocks]] = await pool.query(
            `
            SELECT COUNT(*) total

            FROM m_block

            WHERE district_id=?
              AND deleted IS NULL
            `,
            [id]
        );

        if (blocks.total > 0) {
            return res.status(409).json({
                success: false,
                message: "Cannot delete district because it contains blocks."
            });
        }

        const [[mainUsage]] = await pool.query(
            `
            SELECT COUNT(*) total

            FROM imd_advisory_main

            WHERE district_lg_code=?
            `,
            [district.district_lg_code]
        );

        if (mainUsage.total > 0) {
            return res.status(409).json({
                success: false,
                message: "Cannot delete district because it is used in advisories."
            });
        }

        const [[detailUsage]] = await pool.query(
            `
            SELECT COUNT(*) total

            FROM imd_advisory_detail

            WHERE district_lg_code=?
            `,
            [district.district_lg_code]
        );

        if (detailUsage.total > 0) {
            return res.status(409).json({
                success: false,
                message: "Cannot delete district because it is used in advisory details."
            });
        }

        await pool.query(
            `
            UPDATE m_district

            SET
                deleted='Y',
                delete_datetime=NOW()

            WHERE district_id=?
            `,
            [id]
        );

        return res.status(200).json({
            success: true,
            message: "District deleted successfully."
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete district."
        });

    }
};