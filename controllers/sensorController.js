// controllers/sensorController.js

import { digitalAgriPool } from "#config/digitalAgriDb";
import {
    getSensorConfig,
    getSensorThreshold
} from "../constant/sensorConfig.js";

export default class SensorController {

    static async getSensorHistory(
        deviceId,
        sensorKey,
        period = "today"
    ) {
        let conn;

        try {
            const sensorConfig = getSensorConfig(sensorKey);

            if (!sensorConfig) {
                throw new Error(`Invalid sensor key: ${sensorKey}`);
            }

            conn = await digitalAgriPool.getConnection();

            const { startDate, endDate } =
                this.getDateRange(period);

            const query = `
                SELECT
                    MIN(id) AS id,
                    FROM_UNIXTIME(
                        FLOOR(UNIX_TIMESTAMP(ts) / 3600) * 3600
                    ) AS ts,
                    AVG(
                        CAST(sensorValue AS DECIMAL(12,4))
                    ) AS value
                FROM iot_sensor_readings
                WHERE deviceId = ?
                  AND sensorKey = ?
                  AND ts >= ?
                  AND ts < ?
                  AND sensorValue IS NOT NULL
                GROUP BY
                    FLOOR(UNIX_TIMESTAMP(ts) / 3600)
                ORDER BY ts ASC
            `;

            const [rows] = await conn.query(query, [
                deviceId,
                sensorKey,
                startDate,
                endDate
            ]);

            return {
                sensor: {
                    key: sensorConfig.key,
                    name: sensorConfig.name,
                    unit: sensorConfig.unit,
                    type: sensorConfig.type
                },

                threshold: getSensorThreshold(sensorKey),

                readings: rows.map(row => ({
                    id: row.id,
                    ts: row.ts,
                    value: row.value === null
                        ? null
                        : Number(row.value)
                })),

                filter: {
                    period,
                    startDate,
                    endDate
                }
            };

        } catch (error) {
            console.error(
                "❌ Get Sensor History Error:",
                error
            );

            throw error;

        } finally {
            if (conn) {
                conn.release();
            }
        }
    }

    static getDateRange(period) {
        const now = new Date();

        const endDate = new Date(now);

        const startDate = new Date(now);

        switch (period) {
            case "today":
                startDate.setHours(0, 0, 0, 0);
                break;

            case "7days":
                startDate.setDate(
                    startDate.getDate() - 7
                );
                break;

            case "15days":
                startDate.setDate(
                    startDate.getDate() - 15
                );
                break;

            case "30days":
                startDate.setDate(
                    startDate.getDate() - 30
                );
                break;

            default:
                throw new Error(
                    `Invalid period: ${period}`
                );
        }

        return {
            startDate,
            endDate
        };
    }
}