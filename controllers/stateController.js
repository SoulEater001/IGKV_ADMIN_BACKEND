import { pool } from "../config/db.js"
import { logActivity } from '../utils/activityLogger.js'
import { ACTIONS } from "../constant/activityActions.js";
import { ENTITIES } from "../constant/activityEntities.js";
import { createApprovalRequest, hasPendingApproval } from "../services/approvalService.js";
import { requiresApproval } from "../utils/approval.js";
import { executeCreateState, executeDeleteState, executeUpdateState } from "../services/stateService.js";

export const getState = async (req, res) => {
    try {
        const [rows] = await pool.query(`
           SELECT
                s.state_id,
                s.state_lg_code,
                s.create_datetime,
                s.name As name,

                en.name AS name_en,
                hi.name AS name_hi

            FROM m_state s

            LEFT JOIN m_state_language en
                ON en.state_id = s.state_id
               AND en.language_id = 2
               AND en.deleted IS NULL

            LEFT JOIN m_state_language hi
                ON hi.state_id = s.state_id
               AND hi.language_id = 1
               AND hi.deleted IS NULL

            WHERE s.deleted IS NULL

            ORDER BY en.name ASC

        `);

        return res.status(200).json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error("Error fetching states:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch states.",
        });
    }
};

export const getStatesPaginated = async (req, res) => {
    try {

        const {
            page = 1,
            limit = 10,
            search = ""
        } = req.query;

        const pageNumber = Number(page);
        const pageSize = Number(limit);
        const offset = (pageNumber - 1) * pageSize;

        const where = [
            "s.deleted IS NULL"
        ];

        const params = [];

        if (search.trim()) {

            where.push(`
                (
                    CAST(s.state_id AS CHAR) LIKE ?
                    OR CAST(s.state_lg_code AS CHAR) LIKE ?
                    OR LOWER(en.name) LIKE LOWER(?)
                    OR LOWER(hi.name) LIKE LOWER(?)
                )
            `);

            const keyword = `%${search.trim()}%`;

            params.push(
                keyword,
                keyword,
                keyword,
                keyword
            );

        }

        const whereSql = where.join("\nAND ");

        const [[countResult]] = await pool.query(
            `
            SELECT COUNT(*) AS total

            FROM m_state s

            LEFT JOIN m_state_language en
                ON en.state_id = s.state_id
               AND en.language_id = 2
               AND en.deleted IS NULL

            LEFT JOIN m_state_language hi
                ON hi.state_id = s.state_id
               AND hi.language_id = 1
               AND hi.deleted IS NULL

            WHERE ${whereSql}
            `,
            params
        );

        const [rows] = await pool.query(
            `
            SELECT
                s.state_id,
                s.state_lg_code,
                s.create_datetime,
                s.name,

                en.name AS name_en,
                hi.name AS name_hi

            FROM m_state s

            LEFT JOIN m_state_language en
                ON en.state_id = s.state_id
               AND en.language_id = 2
               AND en.deleted IS NULL

            LEFT JOIN m_state_language hi
                ON hi.state_id = s.state_id
               AND hi.language_id = 1
               AND hi.deleted IS NULL

            WHERE ${whereSql}

            ORDER BY en.name ASC

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
            data: rows
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch states."
        });

    }
};

export const getStateById = async (req, res) => {
    try {

        const { id } = req.params;

        const [[state]] = await pool.query(
            `
             SELECT
                s.state_id,
                s.state_lg_code,
                s.create_datetime,

                en.name AS name_en,
                hi.name AS name_hi

            FROM m_state s

            LEFT JOIN m_state_language en
                ON en.state_id = s.state_id
               AND en.language_id = 2
               AND en.deleted IS NULL

            LEFT JOIN m_state_language hi
                ON hi.state_id = s.state_id
               AND hi.language_id = 1
               AND hi.deleted IS NULL

            WHERE
                s.state_id = ?
                AND s.deleted IS NULL
            `,
            [id]
        );

        if (!state) {
            return res.status(404).json({
                success: false,
                message: "State not found."
            });
        }

        return res.status(200).json({
            success: true,
            data: state
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch state."
        });

    }
};

export const createState = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const {
            name_en,
            name_hi,
            state_lg_code
        } = req.body;

        if (!name_en?.trim() || !name_hi?.trim() || !state_lg_code) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: "English and hindi name and LG code are required."
            });
        }

        const [[existing]] = await connection.query(
            `
            SELECT state_id
            FROM m_state
            WHERE (
                    LOWER(name) = LOWER(?)
                 OR state_lg_code = ?
            )
            AND (deleted IS NULL OR deleted = 'N')
            `,
            [
                name_en.trim(),
                state_lg_code
            ]
        );

        if (existing) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: "State already exists."
            });
        }
        const stateData = {
            name_en: name_en.trim(),
            name_hi: name_hi.trim(),
            state_lg_code
        };

        if (requiresApproval(req.user)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.STATE,
                ACTIONS.CREATE,
                {
                    state_lg_code,
                    name_en: stateData.name_en
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "A state creation request with this name or LG code is already pending."
                });

            }

            await createApprovalRequest(connection, {
                resource: ENTITIES.STATE,
                action: ACTIONS.CREATE,
                payload: stateData,
                requestedBy: req.user.id
            });

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.CREATE,
                entity: ENTITIES.STATE,
                entityId: req.user.id,
                description: `${req.user.name} requested creation of state ${stateData.name_en}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message: "State creation request sent for approval."
            });

        } else {
            const stateId = await executeCreateState(
                connection,
                stateData,
                req.user.id
            );

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.CREATE,
                entity: ENTITIES.STATE,
                entityId: stateId,
                description: `${req.user.name} created state ${stateData.name_en}`,
                ipAddress: req.ip
            });

            return res.status(201).json({
                success: true,
                message: "State created successfully."
            });
        }
    } catch (error) {

        console.error(error);
        await connection.rollback();
        return res.status(500).json({
            success: false,
            message: "Failed to create state."
        });

    } finally {
        connection.release();
    }
};

export const updateState = async (req, res) => {
    const connection = await pool.getConnection();

    try {

        await connection.beginTransaction();

        const { id } = req.params;

        const {
            name_en,
            name_hi,
            state_lg_code
        } = req.body;

        if (!name_en?.trim() || !name_hi?.trim() || !state_lg_code) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "English name, Hindi name and LG code are required."
            });

        }

        const [[state]] = await connection.query(
            `
            SELECT
                name,
                state_id,
                state_lg_code
            FROM m_state
            WHERE state_id = ?
            `,
            [id]
        );

        if (!state) {

            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "State not found."
            });

        }

        const [[existing]] = await connection.query(
            `
            SELECT state_id
            FROM m_state
            WHERE
                (
                    LOWER(name) = LOWER(?)
                    OR state_lg_code = ?
                )
                AND state_id <> ?
                AND (deleted IS NULL OR deleted = 'N')
            `,
            [
                name_en.trim(),
                state_lg_code,
                id
            ]
        );

        if (existing) {

            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: "State already exists."
            });

        }

        const stateData = {
            id: Number(id),
            name_en: name_en.trim(),
            name_hi: name_hi.trim(),
            state_lg_code
        };

        if (requiresApproval(req.user)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.STATE,
                ACTIONS.UPDATE,
                {
                    id: Number(id)
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "A state update request is already pending approval."
                });

            }

            await createApprovalRequest(connection, {
                resource: ENTITIES.STATE,
                action: ACTIONS.UPDATE,
                recordId: Number(id),
                payload: stateData,
                requestedBy: req.user.id
            });

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.UPDATE,
                entity: ENTITIES.STATE,
                entityId: Number(id),
                description: `${req.user.name} requested update of state ${name_en.trim()}`,
                ipAddress: req.ip
            });

            return res.status(202).json({
                success: true,
                approvalRequired: true,
                message: "State update submitted for approval."
            });

        } else {
            await executeUpdateState(
                connection,
                stateData,
                req.user.id
            );
            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.UPDATE,
                entity: ENTITIES.STATE,
                entityId: id,
                description: `${req.user.name} updated state ${name_en.trim()}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                message: "State updated successfully."
            });
        }
    } catch (error) {

        await connection.rollback();

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message||"Failed to update state."
        });

    } finally {

        connection.release();

    }
};

export const deleteState = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;

        const [[state]] = await connection.query(
            `
            SELECT
                name,
                state_id,
                state_lg_code
            FROM m_state
            WHERE state_id = ?
            `,
            [id]
        );

        if (!state) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: "State not found."
            });
        }

        const lgCode = state.state_lg_code;

        const [[districtUsage]] = await connection.query(
            `
            SELECT COUNT(*) total
            FROM m_district
            WHERE state_id = ?
              AND deleted IS NULL
            `,
            [id]
        );

        if (districtUsage.total > 0) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: "Cannot delete state because it contains districts."
            });
        }

        const [[mainUsage]] = await connection.query(
            `
            SELECT COUNT(*) total
            FROM imd_advisory_main
            WHERE state_lg_code = ?
            `,
            [lgCode]
        );

        if (mainUsage.total > 0) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: "Cannot delete state because it is used in advisory main."
            });
        }

        const [[detailUsage]] = await connection.query(
            `
            SELECT COUNT(*) total
            FROM imd_advisory_detail
            WHERE state_lg_code = ?
            `,
            [lgCode]
        );

        if (detailUsage.total > 0) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: "Cannot delete state because it is used in advisory details."
            });
        }

        const payload = {
            id: state.state_id,
            name: state.name,
            state_lg_code: state.state_lg_code
        };

        if (requiresApproval(req.user)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.STATE,
                ACTIONS.DELETE,
                {
                    id: state.state_id
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "A delete request for this state is already pending."
                });

            }

            await createApprovalRequest(connection, {
                resource: ENTITIES.STATE,
                action: ACTIONS.DELETE,
                recordId: state.state_id,
                payload,
                requestedBy: req.user.id
            });

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.DELETE,
                entity: ENTITIES.STATE,
                entityId: state.state_id,
                description: `${req.user.name} requested deletion of state ${state.name}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message: "State deletion request sent for approval."
            });

        } else {
            await executeDeleteState(
                connection,
                state.state_id,
                req.user.id
            );
            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.DELETE,
                entity: ENTITIES.STATE,
                entityId: state.state_id,
                description: `${req.user.name} deleted state ${state.name}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                message: "State deleted successfully."
            });
        }
    } catch (error) {

        console.error(error);
        await connection.rollback();
        return res.status(500).json({
            success: false,
            message: "Failed to delete state."
        });

    } finally {
        connection.release();
    }
};