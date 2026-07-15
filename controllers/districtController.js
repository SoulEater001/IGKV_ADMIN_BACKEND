import { pool } from "../config/db.js";
import { logActivity } from '../utils/activityLogger.js'
import { ACTIONS } from "../constant/activityActions.js";
import { ENTITIES } from "../constant/activityEntities.js";
import { createApprovalRequest, hasPendingApproval } from "../services/approvalService.js";
import { requiresApproval } from "../utils/approval.js";
import { executeCreateDistrict, executeDeleteDistrict } from "../services/districtService.js";

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

export const getDistrictsPaginated = async (req, res) => {
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
                    LOWER(en.name) LIKE LOWER(?)
                    OR LOWER(hi.name) LIKE ?
                    OR LOWER(d.name) LIKE LOWER(?)
                    OR LOWER(s.name) LIKE LOWER(?)
                    OR LOWER(z.name) LIKE LOWER(?)
                    OR CAST(d.district_lg_code AS CHAR) LIKE ?
                )
            `;

            const keyword = `%${search}%`;

            params.push(
                keyword,
                keyword,
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

LEFT JOIN m_district_language en
    ON en.district_id = d.district_id
   AND en.language_id = 2
   AND en.deleted IS NULL

LEFT JOIN m_district_language hi
    ON hi.district_id = d.district_id
   AND hi.language_id = 1
   AND hi.deleted IS NULL

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
                d.create_datetime,

                en.name AS name_en,
                hi.name AS name_hi

            FROM m_district d

            LEFT JOIN m_state s
                ON d.state_id = s.state_id

            LEFT JOIN m_zone z
                ON d.zone_id = z.Zone_id

            LEFT JOIN m_district_language en
                ON en.district_id = d.district_id
               AND en.language_id = 2
               AND en.deleted IS NULL

            LEFT JOIN m_district_language hi
                ON hi.district_id = d.district_id
               AND hi.language_id = 1
               AND hi.deleted IS NULL
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
            total: countResult.total,
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

export const getDistricts = async (req, res) => {
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
             SELECT
                d.district_id,
                d.state_id,
                d.zone_id,
                d.district_lg_code,
                d.create_datetime,

                 s.name AS state_name,
                 z.name as zone_name,
                en.name AS name_en,
                hi.name AS name_hi

            FROM m_district d

            LEFT JOIN m_state s
                ON s.state_id = d.state_id

            LEFT JOIN m_zone z
                ON z.Zone_id = d.zone_id

            LEFT JOIN m_district_language en
                ON en.district_id = d.district_id
               AND en.language_id = 2
               AND en.deleted IS NULL

            LEFT JOIN m_district_language hi
                ON hi.district_id = d.district_id
               AND hi.language_id = 1
               AND hi.deleted IS NULL

            WHERE
                d.district_id = ?
                AND d.deleted IS NULL
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
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const {
            name_en,
            name_hi,
            state_id,
            zone_id,
            district_lg_code
        } = req.body;

        if (
            !name_en?.trim() ||
            !name_hi?.trim() ||
            !state_id ||
            !district_lg_code
        ) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: "English name, Hindi name, State, Zone and LG Code are required."
            });
        }

        const districtData = {
            name_en: name_en.trim(),
            name_hi: name_hi.trim(),
            state_id,
            zone_id,
            district_lg_code
        };

        if (requiresApproval(req.user)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.DISTRICT,
                ACTIONS.CREATE,
                {
                    name_en: districtData.name_en
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "A district creation request with this name is already pending."
                });

            }

            await createApprovalRequest(connection, {
                resource: ENTITIES.DISTRICT,
                action: ACTIONS.CREATE,
                payload: districtData,
                requestedBy: req.user.id
            });

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.CREATE,
                entity: ENTITIES.DISTRICT,
                entityId: req.user.id,
                description: `${req.user.name} requested creation of district ${districtData.name_en}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message: "District creation request sent for approval."
            });

        } else {
            const districtId = await executeCreateDistrict(
                connection,
                districtData,
                req.user.id
            );

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.CREATE,
                entity: ENTITIES.DISTRICT,
                entityId: districtId,
                description: `${req.user.name} created district ${districtData.name_en}`,
                ipAddress: req.ip
            });

            return res.status(201).json({
                success: true,
                message: "District created successfully."
            });
        }
    } catch (error) {

        console.error(error);
        await connection.rollback();
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to create district."
        });
    } finally {
        connection.release();
    }
};

export const updateDistrict = async (req, res) => {

    const connection = await pool.getConnection();

    try {

        await connection.beginTransaction();

        const { id } = req.params;

        const {
            name_en,
            name_hi,
            state_id,
            zone_id,
            district_lg_code
        } = req.body;

        if (
            !name_en?.trim() ||
            !name_hi?.trim() ||
            !state_id ||
            !district_lg_code
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "English name, Hindi name, State and LG Code are required."
            });
        }

        const [[district]] = await connection.query(
            `
            SELECT
                district_id,
                district_lg_code
            FROM m_district
            WHERE district_id = ?
              AND deleted IS NULL
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
                name_en.trim(),
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
                district_lg_code=?,
                modify_by = ?
            WHERE district_id=?
            `,
            [
                name_en.trim(),
                String(state_id),
                zone_id,
                district_lg_code,
                req.user.id,
                id
            ]
        );

        await connection.query(
            `
            UPDATE m_district_language
            SET
                state_id = ?,
                name = ?,
                modify_by = ?
            WHERE
                district_id = ?
                AND language_id = 2
                AND deleted IS NULL
            `,
            [
                state_id,
                name_en.trim(),
                req.user.id,
                id
            ]
        );

        await connection.query(
            `
            UPDATE m_district_language
            SET
                state_id = ?,
                name = ?,
                modify_by = ?
            WHERE
                district_id = ?
                AND language_id = 1
                AND deleted IS NULL
            `,
            [
                state_id,
                name_hi.trim(),
                req.user.id,
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

        const description =
            oldLgCode === district_lg_code
                ? `${req.user.name} updated district ${name_en.trim()}`
                : `${req.user.name} updated district ${name_en.trim()} and changed its LG code`;

        await logActivity({
            userId: req.user.id,
            action: ACTIONS.UPDATE,
            entity: ENTITIES.DISTRICT,
            entityId: id,
            description,
            ipAddress: req.ip
        });

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
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction()
        const { id } = req.params;

        const [[district]] = await connection.query(
            `
            SELECT
                district_id,
                district_lg_code,
                name

            FROM m_district

            WHERE district_id=?
            AND deleted is NULL
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

        const [[blocks]] = await connection.query(
            `
            SELECT COUNT(*) total

            FROM m_block

            WHERE district_id=?
              AND deleted IS NULL
            `,
            [id]
        );

        if (blocks.total > 0) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: "Cannot delete district because it contains blocks."
            });
        }

        const [[mainUsage]] = await connection.query(
            `
            SELECT COUNT(*) total

            FROM imd_advisory_main

            WHERE district_lg_code=?
            `,
            [district.district_lg_code]
        );

        if (mainUsage.total > 0) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: "Cannot delete district because it is used in advisories."
            });
        }

        const [[detailUsage]] = await connection.query(
            `
            SELECT COUNT(*) total

            FROM imd_advisory_detail

            WHERE district_lg_code=?
            `,
            [district.district_lg_code]
        );

        if (detailUsage.total > 0) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: "Cannot delete district because it is used in advisory details."
            });
        }
        const payload = {
            id: district.district_id,
            name: district.name
        }
        if (requiresApproval(req.user)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.DISTRICT,
                ACTIONS.DELETE,
                {
                    id : payload.district_id
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "A district deletion request is already pending."
                });

            }

            await createApprovalRequest(connection, {
                resource: ENTITIES.DISTRICT,
                action: ACTIONS.DELETE,
                payload,
                requestedBy: req.user.id
            });

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.DELETE,
                entity: ENTITIES.DISTRICT,
                entityId: id,
                description: `${req.user.name} requested deletion of district ${district.name}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message: "District deletion request sent for approval."
            });

        } else {
            await executeDeleteDistrict(
                connection,
                payload.id,
                req.user.id
            );
            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.DELETE,
                entity: ENTITIES.DISTRICT,
                entityId: id,
                description: `${req.user.name} deleted district ${district.name}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                message: "District deleted successfully."
            });
        }
    } catch (error) {

        console.error(error);
        await connection.rollback();
        return res.status(500).json({
            success: false,
            message: "Failed to delete district."
        });

    } finally {
        connection.release();
    }
};