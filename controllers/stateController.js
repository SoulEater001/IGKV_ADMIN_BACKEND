import { pool } from "../config/db.js"
import { logActivity } from '../utils/activityLogger.js'
import { ACTIONS } from "../constant/activityActions.js";
import { ENTITIES } from "../constant/activityEntities.js";

export const getStates = async (req, res) => {
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

        const [result] = await connection.query(
            `
            INSERT INTO m_state
            (
                name,
                state_lg_code,
                create_by
            )
            VALUES (?, ?, ?)
            `,
            [
                name_en.trim(),
                state_lg_code,
                req.user.id
            ]
        );
        const stateId = result.insertId;

        await connection.query(
            `
            INSERT INTO m_state_language
            (
                state_id,
                language_id,
                name,
                create_by
            )
            VALUES
                (?, 2, ?, ?),
                (?, 1, ?, ?)
            `,
            [
                stateId,
                name_en.trim(),
                req.user.id,

                stateId,
                name_hi.trim(),
                req.user.id
            ]
        );

        await connection.commit();

        await logActivity({
            userId: req.user.id,
            action: ACTIONS.CREATE,
            entity: ENTITIES.STATE,
            entityId: stateId,
            description: `${req.user.name} created state ${name_en.trim()}`,
            ipAddress: req.ip
        });

        return res.status(201).json({
            success: true,
            message: "State created successfully."
        });

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

        const oldLgCode = state.state_lg_code;

        await connection.query(
            `
            UPDATE m_state
            SET
                name = ?,
                state_lg_code = ?,
                modify_by = ?
            WHERE state_id = ?
            `,

            [
                name_en.trim(),
                state_lg_code,
                req.user.id,
                id
            ]
        );

        await connection.query(
            `
    UPDATE m_state_language
    SET
        name = ?,
        modify_by = ?
    WHERE
        state_id = ?
        AND language_id = 2
        AND deleted IS NULL
    `,
            [
                name_en.trim(),
                req.user.id,
                id
            ]
        );

        await connection.query(
            `
    UPDATE m_state_language
    SET
        name = ?,
        modify_by = ?
    WHERE
        state_id = ?
        AND language_id = 1
        AND deleted IS NULL
    `,
            [
                name_hi.trim(),
                req.user.id,
                id
            ]
        );

        if (oldLgCode !== state_lg_code) {

            await connection.query(
                `
                UPDATE imd_advisory_main
                SET state_lg_code = ?
                WHERE state_lg_code = ?
                `,
                [
                    state_lg_code,
                    oldLgCode
                ]
            );

            await connection.query(
                `
                UPDATE imd_advisory_detail
                SET state_lg_code = ?
                WHERE state_lg_code = ?
                `,
                [
                    state_lg_code,
                    oldLgCode
                ]
            );

        }

        await connection.commit();

        const description =
            oldLgCode === state_lg_code
                ? `${req.user.name} updated state ${name_en.trim()}`
                : `${req.user.name} updated state ${name_en.trim()} and changed its LG code`;

        await logActivity({
            userId: req.user.id,
            action: ACTIONS.UPDATE,
            entity: ENTITIES.STATE,
            entityId: id,
            description,
            ipAddress: req.ip
        });

        return res.status(200).json({
            success: true,
            message: "State updated successfully."
        });

    } catch (error) {

        await connection.rollback();

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to update state."
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

        const [[state]] = await pool.query(
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

        const [[districtUsage]] = await pool.query(
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

        const [[mainUsage]] = await pool.query(
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

        const [[detailUsage]] = await pool.query(
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

        await pool.query(
            `
            UPDATE m_state
            SET
                deleted='Y',
                delete_datetime=NOW(),
                delete_by = ?
            WHERE state_id=?
            `,
            [req.user.id, id]
        );

        await connection.query(
            `
        UPDATE m_state_language
        SET
            deleted = 'Y',
            delete_datetime = NOW(),
            delete_by = ?
        WHERE
            state_id = ?
            AND deleted IS NULL
        `,
            [
                req.user.id,
                id
            ]
        );

        await connection.commit();

        await logActivity({
            userId: req.user.id,
            action: ACTIONS.DELETE,
            entity: ENTITIES.STATE,
            entityId: id,
            description: `${req.user.name} deleted state ${state.name}`,
            ipAddress: req.ip
        });

        return res.status(200).json({
            success: true,
            message: "State deleted successfully."
        });

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