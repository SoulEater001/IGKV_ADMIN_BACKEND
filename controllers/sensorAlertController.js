import { pool } from "../config/db.js";
import { logActivity } from "../utils/activityLogger.js";
import { ACTIONS } from "../constant/activityActions.js";
import { ENTITIES } from "../constant/activityEntities.js";
import { requiresApproval } from "../utils/approval.js";
import {
    hasPendingApproval,
    createApprovalRequest
} from "../services/approvalService.js";
import {
    executeCreateSensorAlert,
    executeUpdateSensorAlert,
    executeDeleteSensorAlert
} from "../services/sensorAlertService.js";

export const getSensorAlerts = async (req, res) => {
    try {

        const [rows] = await pool.query(
            `
            SELECT
                sa.id,

                sa.crop_id,
                c.imd_crop_name AS crop_name,
                c.imd_crop_name_h AS crop_name_h,

                sa.stage_id,
                cs.stage_name,
                cs.stage_name_h,

                sa.sensor_key,
                sa.sensor_status,
                sa.sensor_alert_text,
                sa.sensor_alert_text_h

            FROM sensor_alert sa

            LEFT JOIN imd_m_crop c
                ON sa.crop_id = c.id

            LEFT JOIN crop_stages cs
                ON sa.stage_id = cs.id

            ORDER BY
                c.imd_crop_name ASC,
                cs.stage_name ASC,
                sa.sensor_key ASC
            `
        );

        return res.json({
            success: true,
            count: rows.length,
            data: rows
        });

    } catch (error) {

        console.error(
            "Error fetching sensor alerts:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch sensor alerts."
        });
    }
};

export const getSensorAlertsPaginated = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = ""
        } = req.query;

        const pageNumber = Number(page);
        const pageSize = Number(limit);
        const offset = (pageNumber - 1) * pageSize;

        let where = `WHERE 1 = 1`;

        const params = [];

        if (search.trim()) {

            where += `
                AND (
                    LOWER(c.imd_crop_name) LIKE LOWER(?)
                    OR LOWER(c.imd_crop_name_h) LIKE LOWER(?)
                    OR LOWER(cs.stage_name) LIKE LOWER(?)
                    OR LOWER(cs.stage_name_h) LIKE LOWER(?)
                    OR LOWER(sa.sensor_key) LIKE LOWER(?)
                    OR LOWER(sa.sensor_status) LIKE LOWER(?)
                    OR LOWER(sa.sensor_alert_text) LIKE LOWER(?)
                    OR LOWER(sa.sensor_alert_text_h) LIKE LOWER(?)
                    OR CAST(sa.id AS CHAR) LIKE ?
                )
            `;

            const keyword = `%${search.trim()}%`;

            params.push(
                keyword,
                keyword,
                keyword,
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

            FROM sensor_alert sa

            LEFT JOIN imd_m_crop c
                ON sa.crop_id = c.id

            LEFT JOIN crop_stages cs
                ON sa.stage_id = cs.id

            ${where}
            `,
            params
        );

        const [rows] = await pool.query(
            `
            SELECT
                sa.id,

                sa.crop_id,
                c.imd_crop_name AS crop_name,
                c.imd_crop_name_h AS crop_name_h,

                sa.stage_id,
                cs.stage_name,
                cs.stage_name_h,

                sa.sensor_key,
                sa.sensor_status,
                sa.sensor_alert_text,
                sa.sensor_alert_text_h

            FROM sensor_alert sa

            LEFT JOIN imd_m_crop c
                ON sa.crop_id = c.id

            LEFT JOIN crop_stages cs
                ON sa.stage_id = cs.id

            ${where}

            ORDER BY sa.id ASC

            LIMIT ?

            OFFSET ?
            `,
            [
                ...params,
                pageSize,
                offset
            ]
        );

        return res.json({
            success: true,
            page: pageNumber,
            limit: pageSize,
            total: countResult.total,
            totalPages: Math.ceil(
                countResult.total / pageSize
            ),
            data: rows
        });

    } catch (error) {

        console.error(
            "Error fetching sensor alerts:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch sensor alerts."
        });
    }
};

export const createSensorAlert = async (req, res) => {

    const connection = await pool.getConnection();

    try {

        await connection.beginTransaction();

        const {
            crop_id,
            stage_id,
            sensor_key,
            sensor_status,
            sensor_alert_text,
            sensor_alert_text_h
        } = req.body;
        const normalizedSensorKey = sensor_key?.trim().toLowerCase();
        const normalizedSensorStatus = sensor_status?.trim().toLowerCase();

        if (
            !crop_id ||
            !stage_id ||
            !normalizedSensorKey?.trim() ||
            !normalizedSensorStatus
        ) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Crop, stage, sensor key and sensor status are required."
            });
        }

        const validStatuses = [
            "low",
            "medium",
            "high",
            "optimal",
            "normal",
            "moderate"
        ];

        if (!validStatuses.includes(normalizedSensorStatus)) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Invalid sensor status."
            });
        }

        const [[crop]] = await connection.query(
            `
            SELECT id
            FROM imd_m_crop
            WHERE id = ?
            `,
            [crop_id]
        );

        if (!crop) {

            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Crop not found."
            });
        }

        const [[stage]] = await connection.query(
            `
            SELECT id
            FROM crop_stages
            WHERE id = ?
            `,
            [stage_id]
        );

        if (!stage) {

            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Crop stage not found."
            });
        }

        const sensorAlertData = {
            crop_id: Number(crop_id),
            stage_id: Number(stage_id),
            sensor_key: normalizedSensorKey,
            sensor_status: normalizedSensorStatus,
            sensor_alert_text:
                sensor_alert_text?.trim() || null,
            sensor_alert_text_h:
                sensor_alert_text_h?.trim() || null
        };

        if (await requiresApproval(connection, req.user.id)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.SENSOR_ALERT,
                ACTIONS.CREATE,
                {
                    crop_id: sensorAlertData.crop_id,
                    stage_id: sensorAlertData.stage_id,
                    sensor_key: sensorAlertData.sensor_key,
                    sensor_status: sensorAlertData.sensor_status
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message:
                        "A sensor alert creation request with these details is already pending."
                });
            }

            await createApprovalRequest(
                connection,
                {
                    resource: ENTITIES.SENSOR_ALERT,
                    action: ACTIONS.CREATE,
                    payload: sensorAlertData,
                    requestedBy: req.user.id
                }
            );

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.CREATE,
                entity: ENTITIES.SENSOR_ALERT,
                entityId: req.user.id,
                description:
                    `${req.user.name} requested creation of sensor alert ${sensorAlertData.sensor_key}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message:
                    "Sensor alert creation request sent for approval."
            });

        } else {

            const sensorAlertId =
                await executeCreateSensorAlert(
                    connection,
                    sensorAlertData
                );

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.CREATE,
                entity: ENTITIES.SENSOR_ALERT,
                entityId: sensorAlertId,
                description:
                    `${req.user.name} created sensor alert ${sensorAlertData.sensor_key}`,
                ipAddress: req.ip
            });

            return res.status(201).json({
                success: true,
                message:
                    "Sensor alert created successfully.",
                data: {
                    id: sensorAlertId
                }
            });
        }

    } catch (error) {

        console.error(error);

        await connection.rollback();

        return res.status(500).json({
            success: false,
            message:
                error.message ||
                "Failed to create sensor alert."
        });

    } finally {

        connection.release();
    }
};

export const updateSensorAlert = async (req, res) => {

    const connection = await pool.getConnection();

    try {

        await connection.beginTransaction();

        const { id } = req.params;

        const {
            crop_id,
            stage_id,
            sensor_key,
            sensor_status,
            sensor_alert_text,
            sensor_alert_text_h
        } = req.body;
        const normalizedSensorKey = sensor_key?.trim().toLowerCase();
        const normalizedSensorStatus = sensor_status?.trim().toLowerCase();
        if (
            !crop_id ||
            !stage_id ||
            !normalizedSensorKey ||
            !normalizedSensorStatus
        ) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Crop, stage, sensor key and sensor status are required."
            });
        }

        const validStatuses = [
            "low",
            "medium",
            "high",
            "optimal",
            "normal",
            "moderate"
        ];

        if (!validStatuses.includes(normalizedSensorStatus)) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Invalid sensor status."
            });
        }

        const [[sensorAlert]] = await connection.query(
            `
            SELECT
                id,
                sensor_key
            FROM sensor_alert
            WHERE id = ?
            `,
            [id]
        );

        if (!sensorAlert) {

            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Sensor alert not found."
            });
        }

        const [[crop]] = await connection.query(
            `
            SELECT id
            FROM imd_m_crop
            WHERE id = ?
            `,
            [crop_id]
        );

        if (!crop) {

            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Crop not found."
            });
        }

        const [[stage]] = await connection.query(
            `
            SELECT id
            FROM crop_stages
            WHERE id = ?
            `,
            [stage_id]
        );

        if (!stage) {

            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Crop stage not found."
            });
        }

        const [[existing]] = await connection.query(
            `
            SELECT id
            FROM sensor_alert
            WHERE crop_id = ?
              AND stage_id = ?
              AND sensor_key = ?
              AND sensor_status = ?
              AND id <> ?
            `,
            [
                crop_id,
                stage_id,
                normalizedSensorKey,
                normalizedSensorStatus,
                id
            ]
        );

        if (existing) {

            await connection.rollback();

            return res.status(409).json({
                success: false,
                message:
                    "Sensor alert already exists."
            });
        }

        const sensorAlertData = {
            id: Number(id),
            crop_id: Number(crop_id),
            stage_id: Number(stage_id),
            sensor_key: normalizedSensorKey,
            sensor_status: normalizedSensorStatus,
            sensor_alert_text:
                sensor_alert_text?.trim() || null,
            sensor_alert_text_h:
                sensor_alert_text_h?.trim() || null
        };

        if (await requiresApproval(connection, req.user.id)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.SENSOR_ALERT,
                ACTIONS.UPDATE,
                {
                    id: Number(id)
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message:
                        "A sensor alert update request is already pending."
                });
            }

            await createApprovalRequest(
                connection,
                {
                    resource: ENTITIES.SENSOR_ALERT,
                    action: ACTIONS.UPDATE,
                    recordId: Number(id),
                    payload: sensorAlertData,
                    requestedBy: req.user.id
                }
            );

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.UPDATE,
                entity: ENTITIES.SENSOR_ALERT,
                entityId: Number(id),
                description:
                    `${req.user.name} requested update of sensor alert ${sensorAlertData.sensor_key}`,
                ipAddress: req.ip
            });

            return res.status(202).json({
                success: true,
                approvalRequired: true,
                message:
                    "Sensor alert update submitted for approval."
            });

        } else {

            await executeUpdateSensorAlert(
                connection,
                sensorAlertData
            );

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.UPDATE,
                entity: ENTITIES.SENSOR_ALERT,
                entityId: Number(id),
                description:
                    `${req.user.name} updated sensor alert ${sensorAlertData.sensor_key}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                message:
                    "Sensor alert updated successfully."
            });
        }

    } catch (error) {

        await connection.rollback();

        console.error(error);

        return res.status(500).json({
            success: false,
            message:
                error.message ||
                "Failed to update sensor alert."
        });

    } finally {

        connection.release();
    }
};

export const deleteSensorAlert = async (req, res) => {

    const connection = await pool.getConnection();

    try {

        await connection.beginTransaction();

        const { id } = req.params;

        const [[sensorAlert]] = await connection.query(
            `
            SELECT
                id,
                crop_id,
                stage_id,
                sensor_key,
                sensor_status
            FROM sensor_alert
            WHERE id = ?
            `,
            [id]
        );

        if (!sensorAlert) {

            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Sensor alert not found."
            });
        }

        const payload = {
            id: sensorAlert.id,
            crop_id: sensorAlert.crop_id,
            stage_id: sensorAlert.stage_id,
            sensor_key: sensorAlert.sensor_key,
            sensor_status: sensorAlert.sensor_status
        };

        if (await requiresApproval(connection, req.user.id)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.SENSOR_ALERT,
                ACTIONS.DELETE,
                {
                    id: sensorAlert.id
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message:
                        "A delete request for this sensor alert is already pending."
                });
            }

            await createApprovalRequest(
                connection,
                {
                    resource: ENTITIES.SENSOR_ALERT,
                    action: ACTIONS.DELETE,
                    recordId: sensorAlert.id,
                    payload,
                    requestedBy: req.user.id
                }
            );

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.DELETE,
                entity: ENTITIES.SENSOR_ALERT,
                entityId: sensorAlert.id,
                description:
                    `${req.user.name} requested deletion of sensor alert ${sensorAlert.sensor_key}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message:
                    "Sensor alert deletion request sent for approval."
            });

        } else {

            const sensorAlertId =
                await executeDeleteSensorAlert(
                    connection,
                    sensorAlert.id
                );

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.DELETE,
                entity: ENTITIES.SENSOR_ALERT,
                entityId: sensorAlert.id,
                description:
                    `${req.user.name} deleted sensor alert ${sensorAlert.sensor_key}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                message:
                    "Sensor alert deleted successfully."
            });
        }

    } catch (error) {

        console.error(error);

        await connection.rollback();

        return res.status(500).json({
            success: false,
            message:
                "Failed to delete sensor alert."
        });

    } finally {

        connection.release();
    }
};