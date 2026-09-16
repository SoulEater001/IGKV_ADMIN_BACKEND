import { pool } from "../config/db.js";
import { logActivity } from '../utils/activityLogger.js'
import { ACTIONS } from "../constant/activityActions.js";
import { ENTITIES } from "../constant/activityEntities.js";
import { requiresApproval } from '../utils/approval.js'
import { hasPendingApproval, createApprovalRequest } from '../services/approvalService.js'
import { executeCreateZone, executeDeleteZone, executeUpdateZone } from "../services/zoneService.js";

export const getZones = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                z.Zone_id,
                en.name,
                hi.name as zone_name_h,
                z.Image_Path,
                z.state_id,
                s.name as state_name,
                z.create_datetime

            FROM m_zone z

            JOIN m_zone_language en
                ON z.Zone_id = en.zone_id
               AND en.language_id = 2
               AND en.deleted IS NULL

            LEFT JOIN m_zone_language hi
                ON hi.zone_id = z.Zone_id
               AND hi.language_id = 1
               AND hi.deleted IS NULL

            LEFT JOIN m_state s
                ON z.state_id = s.state_id

            WHERE z.deleted IS NULL

            ORDER BY en.name ASC
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

        const zoneData = {
            name_en: name_en.trim(),
            name_hi: name_hi.trim(),
            state_id,
            imagePath
        };

        if (await requiresApproval(connection, req.user.id)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.ZONE,
                ACTIONS.CREATE,
                {
                    name_en: zoneData.name_en,
                    state_id: zoneData.state_id
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "A zone creation request with this name already exists."
                });

            }

            await createApprovalRequest(connection, {
                resource: ENTITIES.ZONE,
                action: ACTIONS.CREATE,
                payload: zoneData,
                requestedBy: req.user.id
            });

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.CREATE,
                entity: ENTITIES.ZONE,
                entityId: req.user.id,
                description: `${req.user.name} requested creation of zone ${zoneData.name_en}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message: "Zone creation request sent for approval."
            });

        } else {
            const zoneId = await executeCreateZone(
                connection,
                zoneData,
                req.user.id
            );

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.CREATE,
                entity: ENTITIES.ZONE,
                entityId: null,
                description: `${req.user.name} created zone ${zoneData.name_en}`,
                ipAddress: req.ip
            });

            return res.status(201).json({
                success: true,
                message: "Zone created successfully."
            });
        }
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

        const zoneData = {
            id: Number(id),
            name_en: name_en.trim(),
            name_hi: name_hi.trim(),
            state_id,
            imagePath
        };

        if (await requiresApproval(connection, req.user.id)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.ZONE,
                ACTIONS.UPDATE,
                {
                    id: Number(id)
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "A zone update request is already pending approval."
                });

            }

            await createApprovalRequest(connection, {
                resource: ENTITIES.ZONE,
                action: ACTIONS.UPDATE,
                recordId: Number(id),
                payload: zoneData,
                requestedBy: req.user.id
            });

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.UPDATE,
                entity: ENTITIES.ZONE,
                entityId: Number(id),
                description: `${req.user.name} requested update of zone ${name_en.trim()}`,
                ipAddress: req.ip
            });

            return res.status(202).json({
                success: true,
                approvalRequired: true,
                message: "Zone update submitted for approval."
            });

        } else {
            await executeUpdateZone(
                connection,
                zoneData,
                req.user.id
            );
            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.UPDATE,
                entity: ENTITIES.ZONE,
                entityId: Number(id),
                description: `${req.user.name} updated zone ${name_en.trim()}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                message: "Zone updated successfully."
            });
        }
    } catch (error) {

        console.error(error);
        await connection.rollback();
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to update zone."
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

        const [[districts]] = await connection.query(
            `
            SELECT COUNT(*) AS total
            FROM m_district
            WHERE Zone_id = ?
              AND deleted IS NULL
            `,
            [id]
        );

        if (districts.total > 0) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Cannot delete zone because it contains districts."
            });
        }

        const payload = {
            id: zone.Zone_id,
            name: zone.name
        };

        if (await requiresApproval(connection, req.user.id)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.ZONE,
                ACTIONS.DELETE,
                {
                    id: zone.Zone_id
                }
            );

            if (pending) {
                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "A delete request for this zone is already pending."
                });
            }

            await createApprovalRequest(connection, {
                resource: ENTITIES.ZONE,
                action: ACTIONS.DELETE,
                recordId: zone.Zone_id,
                payload,
                requestedBy: req.user.id
            });

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.DELETE,
                entity: ENTITIES.ZONE,
                entityId: zone.Zone_id,
                description: `${req.user.name} requested deletion of zone ${zone.name}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message: "Zone deletion request sent for approval."
            });

        } else {

            await executeDeleteZone(
                connection,
                zone.Zone_id,
                req.user.id
            );

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.DELETE,
                entity: ENTITIES.ZONE,
                entityId: zone.Zone_id,
                description: `${req.user.name} deleted zone ${zone.name}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                message: "Zone deleted successfully."
            });
        }

    } catch (error) {
        console.error(error);

        await connection.rollback();

        return res.status(500).json({
            success: false,
            message: "Failed to delete zone."
        });

    } finally {
        connection.release();
    }
};