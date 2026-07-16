import { pool } from "../config/db.js";
import { ACTIONS } from "../constant/activityActions.js";
import { ENTITIES } from "../constant/activityEntities.js";
import { logActivity } from '../utils/activityLogger.js'
import { hasPendingApproval, createApprovalRequest } from '../services/approvalService.js'
import { requiresApproval } from '../utils/approval.js'
import { executeCreateAdvisory, executeCreateAdvisoryType, executeDeleteAdvisory, executeDeleteAdvisoryType, executeUpdateAdvisory, executeUpdateAdvisoryType } from "../services/advisoryService.js";

export const getAdvisoriesPaginated = async (req, res) => {
    try {
        const {
            stateLgCode,
            districtLgCode,
            blockLgCode,
            languageId,
            fromDate,
            toDate,
            search = '',
            page = 1,
            limit = 10,
        } = req.query;

        if (fromDate && toDate) {

            const from = new Date(fromDate);
            const to = new Date(toDate);

            if (isNaN(from.getTime()) || isNaN(to.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid date format."
                });
            }

            if (from > to) {
                return res.status(400).json({
                    success: false,
                    message: "From date cannot be later than To date."
                });
            }

        }

        if (!stateLgCode || !districtLgCode || !blockLgCode || !languageId) {
            return res.status(400).json({
                success: false,
                message: "stateLgCode, districtLgCode, blockLgCode and languageId are required.",
            });
        }

        const pageNumber = Number(page);
        const pageSize = Number(limit);
        const offset = (pageNumber - 1) * pageSize;
        const where = [
            "d.state_lg_code = ?",
            "d.district_lg_code = ?",
            "d.block_lg_code = ?",
            "d.language_id = ?",
        ];

        const params = [
            stateLgCode,
            districtLgCode,
            blockLgCode,
            languageId
        ];

        if (fromDate) {
            where.push("DATE(m.advisory_date) >= ?");
            params.push(fromDate);
        }

        if (toDate) {
            where.push("DATE(m.advisory_date) <= ?");
            params.push(toDate);
        }

        const whereSql = where.join("\nAND ");

        let searchSql = "";

        if (search?.trim()) {

            searchSql = `
                AND (
                    CAST(d.id AS CHAR) LIKE ?
                    OR d.advisory LIKE ?
                    OR c.img_category_name LIKE ?
                    OR at.imd_advisory_type_name LIKE ?
                    OR DATE_FORMAT(m.advisory_date, '%d-%m-%Y') LIKE ?
                )
            `;

            const keyword = `%${search.trim()}%`;

            params.push(
                keyword,
                keyword,
                keyword,
                keyword,
                keyword
            );

        }

        // Total records
        const [[countResult]] = await pool.query(
            `
            SELECT COUNT(*) AS total
            FROM imd_advisory_detail d

            JOIN imd_advisory_main m
                ON d.advisory_main_id = m.id

            LEFT JOIN imd_m_category c
                ON d.cat_id = c.imd_category_id

            LEFT JOIN imd_advisory_type at
                ON d.advisory_type_id = at.imd_advisory_type_id

            WHERE
                ${whereSql}
                ${searchSql}
            `,
            params
        );

        // Fetch advisories
        const [rows] = await pool.query(
            `
            SELECT
                d.id,
                d.advisory,
                d.language_id,

                c.imd_category_id,
                c.img_category_name AS category,

                at.imd_advisory_type_id,
                at.imd_advisory_type_name AS advisory_type,

                m.advisory_date,
                m.create_datetime

            FROM imd_advisory_detail d

            JOIN imd_advisory_main m
                ON d.advisory_main_id = m.id

            LEFT JOIN imd_m_category c
                ON d.cat_id = c.imd_category_id

            LEFT JOIN imd_advisory_type at
                ON d.advisory_type_id = at.imd_advisory_type_id

            WHERE 
                ${whereSql} 
                ${searchSql}

            ORDER BY m.advisory_date DESC, d.id DESC

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
            page: pageNumber,
            limit: pageSize,
            total: countResult.total,
            totalPages: Math.ceil(countResult.total / pageSize),
            data: rows,
        });

    } catch (error) {
        console.error("Error fetching advisories:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch advisories.",
        });
    }
};

export const getAdvisoryTypes = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                id,
                imd_advisory_type_id,
                imd_advisory_type_name,
                imd_advisory_type_name_h
            FROM imd_advisory_type
            ORDER BY id ASC
        `);

        res.json({
            success: true,
            data: rows,
            count: rows.length
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch advisory types."
        });

    }
};

export const createAdvisoryType = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const {
            imd_advisory_type_name,
            imd_advisory_type_name_h
        } = req.body;

        if (!imd_advisory_type_name?.trim() || !imd_advisory_type_name_h.trim()) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: "Advisory type name is required."
            });
        }

        const advisoryTypeData = {
            imd_advisory_type_name: imd_advisory_type_name.trim(),
            imd_advisory_type_name_h:
                imd_advisory_type_name_h?.trim() || null
        };

        const [[existing]] = await connection.query(
            `
            SELECT id
            FROM imd_advisory_type
            WHERE imd_advisory_type_name = ?
            `,
            [advisoryTypeData.imd_advisory_type_name]
        );

        if (existing) {

            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: "Advisory type already exists."
            });

        }

        if (requiresApproval(req.user)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.ADVISORY_TYPE,
                ACTIONS.CREATE,
                {
                    imd_advisory_type_name:
                        advisoryTypeData.imd_advisory_type_name
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "An advisory type creation request with this name is already pending."
                });

            }

            await createApprovalRequest(connection, {
                resource: ENTITIES.ADVISORY_TYPE,
                action: ACTIONS.CREATE,
                payload: advisoryTypeData,
                requestedBy: req.user.id
            });

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.CREATE,
                entity: ENTITIES.ADVISORY_TYPE,
                entityId: req.user.id,
                description: `${req.user.name} requested creation of advisory type ${advisoryTypeData.imd_advisory_type_name}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message: "Advisory type creation request sent for approval."
            });

        } else {
            const advisoryTypeId =
                await executeCreateAdvisoryType(
                    connection,
                    advisoryTypeData
                );

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.CREATE,
                entity: ENTITIES.ADVISORY_TYPE,
                entityId: advisoryTypeId,
                description: `${req.user.name} created advisory type ${imd_advisory_type_name.trim()}`,
                ipAddress: req.ip
            });

            return res.status(201).json({
                success: true,
                message: "Advisory type created successfully.",
                data: {
                    id: advisoryTypeId,
                    imd_advisory_type_id: advisoryTypeId
                }
            });
        }
    } catch (error) {

        console.error(error);
        await connection.rollback();
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to create advisory type."
        });

    } finally {
        connection.release();
    }
};

export const updateAdvisoryType = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;

        const {
            imd_advisory_type_name,
            imd_advisory_type_name_h
        } = req.body;

        if (!imd_advisory_type_name?.trim()) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: "Advisory type name is required."
            });
        }

        const [[advisoryType]] = await connection.query(
            `
            SELECT
                id,
                imd_advisory_type_name
            FROM imd_advisory_type
            WHERE id = ?
            `,
            [id]
        );

        if (!advisoryType) {

            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Advisory type not found."
            });

        }

        const [[existing]] = await connection.query(
            `
            SELECT id
            FROM imd_advisory_type
            WHERE LOWER(imd_advisory_type_name) = LOWER(?)
              AND id <> ?
            `,
            [
                imd_advisory_type_name.trim(),
                id
            ]
        );

        if (existing) {

            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: "Advisory type already exists."
            });

        }
        const advisoryTypeData = {

            id: Number(id),

            imd_advisory_type_name:
                imd_advisory_type_name.trim(),

            imd_advisory_type_name_h:
                imd_advisory_type_name_h?.trim() || null

        };

        if (requiresApproval(req.user)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.ADVISORY_TYPE,
                ACTIONS.UPDATE,
                {
                    id: Number(id)
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "An advisory type update request is already pending."
                });

            }

            await createApprovalRequest(
                connection,
                {
                    resource: ENTITIES.ADVISORY_TYPE,
                    action: ACTIONS.UPDATE,
                    recordId: Number(id),
                    payload: advisoryTypeData,
                    requestedBy: req.user.id
                }
            );

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.UPDATE,
                entity: ENTITIES.ADVISORY_TYPE,
                entityId: Number(id),
                description: `${req.user.name} requested update of advisory type ${imd_advisory_type_name.trim()}`,
                ipAddress: req.ip
            });

            return res.status(202).json({
                success: true,
                approvalRequired: true,
                message: "Advisory type update submitted for approval."
            });

        } else {
            await executeUpdateAdvisoryType(
                connection,
                advisoryTypeData
            );

            await connection.commit();
            await logActivity({
                userId: req.user.id,
                action: ENTITIES.UPDATE,
                entity: ENTITIES.ADVISORY_TYPE,
                entityId: Number(id),
                description: `${req.user.name} updated advisory type ${imd_advisory_type_name.trim()}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                message: "Advisory type updated successfully."
            });
        }
    } catch (error) {
        await connection.rollback();
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to update advisory type."
        });

    } finally { connection.release(); }
};

export const deleteAdvisoryType = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;

        // Check if advisory type exists
        const [[advisoryType]] = await connection.query(
            `
            SELECT id, imd_advisory_type_name
            FROM imd_advisory_type
            WHERE id = ?
            `,
            [id]
        );

        if (!advisoryType) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: "Advisory type not found."
            });
        }

        // Check if it is being used
        const [[usage]] = await connection.query(
            `
            SELECT COUNT(*) AS total
            FROM imd_advisory_detail
            WHERE advisory_type_id = ?
            `,
            [id]
        );

        if (usage.total > 0) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: "Cannot delete advisory type because it is used by existing advisories."
            });
        }

        const payload = {
            id: advisoryType.id,
            imd_advisory_type_name: advisoryType.imd_advisory_type_name
        };

        if (requiresApproval(req.user)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.ADVISORY_TYPE,
                ACTIONS.DELETE,
                {
                    id: advisoryType.id
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "A delete request for this advisory type is already pending."
                });

            }

            await createApprovalRequest(connection, {
                resource: ENTITIES.ADVISORY_TYPE,
                action: ACTIONS.DELETE,
                recordId: advisoryType.id,
                payload,
                requestedBy: req.user.id
            });

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.DELETE,
                entity: ENTITIES.ADVISORY_TYPE,
                entityId: advisoryType.id,
                description: `${req.user.name} requested deletion of advisory type ${advisoryType.imd_advisory_type_name}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message: "Advisory type deletion request sent for approval."
            });

        } else {
            const advisoryTypeId = await executeDeleteAdvisoryType(
                connection,
                advisoryType.id
            );

            await connection.commit();
            await logActivity({
                userId: req.user.id,
                action: ACTIONS.DELETE,
                entity: ENTITIES.ADVISORY_TYPE,
                entityId: advisoryTypeId,
                description: `${req.user.name} deleted advisory type ${advisoryType.imd_advisory_type_name}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                message: "Advisory type deleted successfully."
            });
        }
    } catch (error) {
        console.error(error);
        await connection.rollback();
        return res.status(500).json({
            success: false,
            message: "Failed to delete advisory type."
        });
    } finally {
        await connection.release();
    }
};

export const updateAdvisory = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;

        const {
            state_lg_code,
            district_lg_code,
            block_lg_code,
            imd_category_id,
            imd_advisory_type_id,
            advisory,
            language_id
        } = req.body;

        if (
            state_lg_code == null ||
            district_lg_code == null ||
            block_lg_code == null ||
            advisory == null ||
            advisory.trim() === "" ||
            language_id == null
        ) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: "All fields are required."
            });
        }

        const [[existing]] = await connection.query(
            `
            SELECT id
            FROM imd_advisory_detail
            WHERE id = ?
            `,
            [id]
        );

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Advisory not found."
            });
        }

        const advisoryData = {

            id: Number(id),

            state_lg_code,
            district_lg_code,
            block_lg_code,

            imd_category_id,
            imd_advisory_type_id,

            advisory: advisory.trim(),

            language_id

        };

        if (requiresApproval(req.user)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.ADVISORY,
                ACTIONS.UPDATE,
                {
                    id: Number(id)
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "An advisory update request is already pending."
                });

            }

            await createApprovalRequest(
                connection,
                {
                    resource: ENTITIES.ADVISORY,
                    action: ACTIONS.UPDATE,
                    recordId: Number(id),
                    payload: advisoryData,
                    requestedBy: req.user.id
                }
            );

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.UPDATE,
                entity: ENTITIES.ADVISORY,
                entityId: Number(id),
                description: `${req.user.name} requested update of an advisory`,
                ipAddress: req.ip
            });

            return res.status(202).json({
                success: true,
                approvalRequired: true,
                message: "Advisory update submitted for approval."
            });

        } else {
            await executeUpdateAdvisory(
                connection,
                advisoryData
            );

            await connection.commit();
            await logActivity({
                userId: req.user.id,
                action: ACTIONS.UPDATE,
                entity: ENTITIES.ADVISORY,
                entityId: id,
                description: `${req.user.name} updated an advisory`,
                ipAddress: req.ip
            });

            res.json({
                success: true,
                message: "Advisory updated successfully."
            });
        }
    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message || "Failed to update advisory."
        });

    }
};

export const createAdvisory = async (req, res) => {
    const connection = await pool.getConnection();
    try {

        await connection.beginTransaction();
        const {
            state_lg_code,
            district_lg_code,
            block_lg_code,
            imd_category_id,
            imd_advisory_type_id,
            language_id,
            advisory,
            advisory_date
        } = req.body;

        if (
            state_lg_code == null ||
            district_lg_code == null ||
            block_lg_code == null ||
            language_id == null ||
            advisory == null ||
            advisory_date == null ||
            advisory.trim() === ""
        ) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: "Please fill all required fields."
            });
        }

        const advisoryData = {
            state_lg_code,
            district_lg_code,
            block_lg_code,
            imd_category_id,
            imd_advisory_type_id,
            language_id,
            advisory: advisory.trim(),
            advisory_date
        };

        //
        // Find today's advisory_main row.
        // If none exists, create one.
        //
        if (requiresApproval(req.user)) {
            const pending = await hasPendingApproval(
                connection,
                ENTITIES.ADVISORY,
                ACTIONS.CREATE,
                {
                    advisory_date,
                    state_lg_code,
                    district_lg_code,
                    block_lg_code,
                    language_id
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "A similar advisory creation request is already pending."
                });

            }

            await createApprovalRequest(connection, {
                resource: ENTITIES.ADVISORY,
                action: ACTIONS.CREATE,
                payload: advisoryData,
                requestedBy: req.user.id
            });

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.CREATE,
                entity: ENTITIES.ADVISORY,
                entityId: req.user.id,
                description: `${req.user.name} requested creation of an advisory`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message: "Advisory creation request sent for approval."
            });

        } else {
            const advisoryId = await executeCreateAdvisory(
                connection,
                advisoryData
            );

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.CREATE,
                entity: ENTITIES.ADVISORY,
                entityId: advisoryId,
                description: `${req.user.name} created an advisory`,
                ipAddress: req.ip
            });

            res.status(201).json({
                success: true,
                message: "Advisory created successfully."
            });
        }
    } catch (error) {
        console.error(error);
        await connection.rollback();
        res.status(500).json({
            success: false,
            message: "Failed to create advisory."
        });
    } finally {
        connection.release();
    }
};

export const deleteAdvisory = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { id } = req.params;

        const [[advisory]] = await connection.query(
            `
            SELECT
                id,
                advisory_main_id
            FROM imd_advisory_detail
            WHERE id = ?
            `,
            [id]
        );

        if (!advisory) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: "Advisory not found."
            });
        }

        const payload = {
            id: advisory.id,
            advisory_main_id: advisory.advisory_main_id
        };

        if (requiresApproval(req.user)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.ADVISORY,
                ACTIONS.DELETE,
                {
                    id: advisory.id
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "A delete request for this advisory is already pending."
                });

            }

            await createApprovalRequest(connection, {
                resource: ENTITIES.ADVISORY,
                action: ACTIONS.DELETE,
                recordId: advisory.id,
                payload,
                requestedBy: req.user.id
            });

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.DELETE,
                entity: ENTITIES.ADVISORY,
                entityId: advisory.id,
                description: `${req.user.name} requested deletion of an advisory`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message: "Advisory deletion request sent for approval."
            });

        } else {
            const advisoryId = await executeDeleteAdvisory(
                connection,
                advisory.id
            );

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.DELETE,
                entity: ENTITIES.ADVISORY,
                entityId: advisoryId,
                description: `${req.user.name} deleted an advisory`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                message: "Advisory deleted successfully."
            });
        }
    } catch (error) {

        console.error(error);
        await connection.rollback();
        return res.status(500).json({
            success: false,
            message: "Failed to delete advisory."
        });

    } finally {
        connection.release();
    }
};