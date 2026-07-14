import { pool } from "../config/db.js";
import { logActivity } from '../utils/activityLogger.js'
import { ACTIONS } from "../constant/activityActions.js";
import { ENTITIES } from "../constant/activityEntities.js";

export const getZones = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                z.Zone_id,
                zl.name,
                z.Image_Path,
                z.state_id,
                s.name as state_name,
                z.create_datetime

            FROM m_zone z

            JOIN m_zone_language zl
                ON z.Zone_id = zl.zone_id
               AND zl.language_id = 2
               AND zl.deleted IS NULL

            LEFT JOIN m_state s
                ON z.state_id = s.state_id

            WHERE z.deleted IS NULL

            ORDER BY zl.name ASC
        `);

        res.json({
            success: true,
            count: rows.length,
            data: rows,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch zones.",
        });
    }
};

export const getZoneById = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await pool.query(
            `
            SELECT
                z.Zone_id,
                z.state_id,
                s.name as state_name,
                z.Image_Path,
                en.name AS name_en,
                hi.name AS name_hi,
                z.create_datetime
            FROM m_zone z

            LEFT JOIN m_state s
                ON z.state_id = s.state_id
                AND s.deleted IS NULL

            LEFT JOIN m_zone_language en
                ON en.zone_id = z.Zone_id
               AND en.language_id = 2
               AND en.deleted IS NULL

            LEFT JOIN m_zone_language hi
                ON hi.zone_id = z.Zone_id
               AND hi.language_id = 1
               AND hi.deleted IS NULL

            WHERE
                z.Zone_id = ?
                AND z.deleted IS NULL;
            `,
            [id]
        );

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message: "Zone not found.",
            });
        }

        res.json({
            success: true,
            data: rows[0],
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch zone.",
        });
    }
};

export const createZone = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const {
            name_en,
            name_hi,
            state_id,
            imagePath = null
        } = req.body;

        if (!name_en?.trim() || !name_hi?.trim()) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: "Zone name is required."
            });
        }

        const [[existing]] = await connection.query(
            `
            SELECT Zone_id
            FROM m_zone
            WHERE LOWER(name) = LOWER(?)
              AND (deleted = 0 OR deleted IS NULL)
            `,
            [name_en.trim()]
        );

        if (existing) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: "Zone already exists."
            });
        }

        const [result] = await connection.query(
            `
            INSERT INTO m_zone
            (
                name,
                state_id,
                Image_Path,
                create_by
            )
            VALUES (?, ?,?,?)
            `,
            [
                name_en.trim(),
                state_id,
                imagePath,
                req.user.id
            ]
        );
        const zoneId = result.insertId;

        await connection.query(
            `
                INSERT INTO m_zone_language
                (
                    zone_id,
                    state_id,
                    language_id,
                    name,
                    create_by
                )
                VALUES
                    (?, ?, 2, ?, ?),
                    (?, ?, 1, ?, ?)
            `,
            [
                zoneId,
                state_id,
                name_en.trim(),
                req.user.id,

                zoneId,
                state_id,
                name_hi.trim(),
                req.user.id
            ]
        );

        await connection.commit();

        await logActivity({
            userId: req.user.id,
            action: ACTIONS.CREATE,
            entity: ENTITIES.ZONE,
            entityId: result.insertId,
            description: `${req.user.name} created zone ${name_en.trim()}`,
            ipAddress: req.ip
        });

        return res.status(201).json({
            success: true,
            message: "Zone created successfully."
        });

    } catch (error) {

        console.error(error);
        await connection.rollback();
        return res.status(500).json({
            success: false,
            message: "Failed to create zone."
        });

    } finally { connection.release(); }
};

export const updateZone = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;

        const {
            name_en,
            name_hi,
            state_id,
            imagePath = null
        } = req.body;

        if (!name_en?.trim() || !name_hi?.trim()) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Both English and Hindi names are required."
            });

        }

        const [[zone]] = await connection.query(
            `
            SELECT Zone_id, name
            FROM m_zone
            WHERE Zone_id = ?
            `,
            [id]
        );

        if (!zone) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: "Zone not found."
            });
        }

        const [[existing]] = await connection.query(
            `
            SELECT Zone_id
            FROM m_zone
            WHERE LOWER(name) = LOWER(?)
              AND Zone_id <> ?
              AND (deleted = 0 OR deleted IS NULL)
            `,
            [
                name_en.trim(),
                id
            ]
        );

        if (existing) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: "Zone already exists."
            });
        }

        await connection.query(
            `
            UPDATE m_zone
            SET
                name = ?,
                state_id = ?,
                Image_Path = ?,
                modify_by = ?
            WHERE Zone_id = ?
            `,
            [
                name_en.trim(),
                state_id,
                imagePath,
                req.user.id,
                id
            ]
        );

        await connection.query(
            `
            UPDATE m_zone_language
            SET
                name = ?,
                state_id = ?,
                modify_by = ?
            WHERE
                zone_id = ?
                AND language_id = 2
                AND deleted IS NULL
            `,
            [
                name_en.trim(),
                state_id,
                req.user.id,
                id
            ]
        );

        await connection.query(
            `
            UPDATE m_zone_language
            SET
                name = ?,
                state_id = ?,
                modify_by = ?
            WHERE
                zone_id = ?
                AND language_id = 1
                AND deleted IS NULL
            `,
            [
                name_hi.trim(),
                state_id,
                req.user.id,
                id
            ]
        );
        await connection.commit();

        await logActivity({
            userId: req.user.id,
            action: ACTIONS.UPDATE,
            entity: ENTITIES.ZONE,
            entityId: id,
            description: `${req.user.name} updated zone ${name_en.trim()}`,
            ipAddress: req.ip
        });

        return res.status(200).json({
            success: true,
            message: "Zone updated successfully."
        });

    } catch (error) {

        console.error(error);
        await connection.rollback();
        return res.status(500).json({
            success: false,
            message: "Failed to update zone."
        });

    } finally {
        connection.release();
    }
};

export const deleteZone = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;

        const [[zone]] = await connection.query(
            `
            SELECT
                Zone_id,
                name
            FROM m_zone
            WHERE Zone_id = ?
            AND deleted IS NULL
            `,
            [id]
        );

        if (!zone) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: "Zone not found."
            });
        }

        // Check if zone has districts
        const [districts] = await connection.query(
            `
            SELECT COUNT(*) AS total
            FROM m_district
            WHERE Zone_id = ?
            AND deleted IS NULL
            `,
            [id]
        );

        if (districts[0].total > 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: "Cannot delete zone because it contains districts.",
            });
        }

        const [result] = await connection.query(
            `
            UPDATE m_zone
            SET
                deleted = 'Y',
                delete_datetime = NOW(),
                delete_by = ?
            WHERE Zone_id = ?
            AND deleted IS NULL
            `,
            [req.user.id, id]
        );


        await connection.query(
            `
            UPDATE m_zone_language
            SET
                deleted = 'Y',
                delete_datetime = NOW(),
                delete_by = ?
            WHERE
                zone_id = ?
                AND deleted IS NULL
            `,
            [
                req.user.id,
                id
            ]
        );

        if (!result.affectedRows) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: "Zone not found.",
            });
        }
        await connection.commit();



        await logActivity({
            userId: req.user.id,
            action: ACTIONS.DELETE,
            entity: ENTITIES.ZONE,
            entityId: id,
            description: `${req.user.name} deleted zone ${zone.name}`,
            ipAddress: req.ip
        });

        res.json({
            success: true,
            message: "Zone deleted successfully.",
        });
    } catch (error) {
        console.error(error);
        await connection.rollback();
        res.status(500).json({
            success: false,
            message: "Failed to delete zone.",
        });
    }
};