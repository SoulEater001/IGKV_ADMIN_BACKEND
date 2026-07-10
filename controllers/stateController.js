import { pool } from "../config/db.js"

export const getStates = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                state_id,
                name,
                state_lg_code,
                create_datetime
            FROM m_state
            WHERE deleted IS NULL
            ORDER BY name ASC
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
                state_id,
                state_lg_code,
                name,
                create_datetime
            FROM m_state
            WHERE state_id = ?
              AND (deleted IS NULL OR deleted = 'N')
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
    try {

        const {
            name,
            state_lg_code
        } = req.body;

        if (!name?.trim() || !state_lg_code) {
            return res.status(400).json({
                success: false,
                message: "State name and LG code are required."
            });
        }

        const [[existing]] = await pool.query(
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
                name.trim(),
                state_lg_code
            ]
        );

        if (existing) {
            return res.status(409).json({
                success: false,
                message: "State already exists."
            });
        }

        await pool.query(
            `
            INSERT INTO m_state
            (
                name,
                state_lg_code
            )
            VALUES (?, ?)
            `,
            [
                name.trim(),
                state_lg_code
            ]
        );

        return res.status(201).json({
            success: true,
            message: "State created successfully."
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to create state."
        });

    }
};

export const updateState = async (req, res) => {
    const connection = await pool.getConnection();

    try {

        await connection.beginTransaction();

        const { id } = req.params;

        const {
            name,
            state_lg_code
        } = req.body;

        if (!name?.trim() || !state_lg_code) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "State name and LG code are required."
            });

        }

        const [[state]] = await connection.query(
            `
            SELECT
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
                name.trim(),
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
                state_lg_code = ?
            WHERE state_id = ?
            `,
            [
                name.trim(),
                state_lg_code,
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
    try {

        const { id } = req.params;

        const [[state]] = await pool.query(
            `
            SELECT
                state_id,
                state_lg_code
            FROM m_state
            WHERE state_id = ?
            `,
            [id]
        );

        if (!state) {
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
                delete_datetime=NOW()
            WHERE state_id=?
            `,
            [id]
        );

        return res.status(200).json({
            success: true,
            message: "State deleted successfully."
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete state."
        });

    }
};