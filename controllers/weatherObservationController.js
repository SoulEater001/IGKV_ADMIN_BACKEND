import { pool } from "../config/db.js";
import { formatWeatherValue, isValidIsoDate, validateObservation } from "../utils/weatherUtils.js";

export const bulkUpsertObservations = async (req, res) => {
    const { observations } = req.body;

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        if (!Array.isArray(observations)) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: "observations must be an array",
            });
        }

        if (observations.length === 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: "No observations provided",
            });
        }

        const invalidStationId = observations.some(
            item =>
                !Number.isInteger(Number(item.station_id)) ||
                Number(item.station_id) <= 0
        );

        if (invalidStationId) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Invalid station_id",
            });
        }

        const stationIds = [
            ...new Set(
                observations.map(item => Number(item.station_id))
            )
        ];

        const [stations] = await connection.query(
            `
    SELECT id
    FROM weather_station
    WHERE id IN (?)
      AND is_active = 1
    `,
            [stationIds]
        );

        const validStationIds = new Set(
            stations.map(station => Number(station.id))
        );

        const invalidStation = stationIds.find(
            id => !validStationIds.has(id)
        );

        if (invalidStation !== undefined) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: `Weather station ${invalidStation} does not exist or is inactive`,
            });
        }

        const invalidDate = observations.some(
            item => !isValidIsoDate(item.observation_date)
        );

        if (invalidDate) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Invalid observation date",
            });
        }

        for (let i = 0; i < observations.length; i++) {
            const error = validateObservation(observations[i]);

            if (error) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Invalid observation at index ${i}: ${error}`,
                });
            }
        }

        const sql = `
            INSERT INTO weather_observation (
                station_id,
                observation_date,
                max_temperature,
                min_temperature,
                rainfall,
                relative_humidity_1,
                relative_humidity_2,
                vapour_pressure_1,
                vapour_pressure_2,
                wind_speed,
                evaporation,
                sunshine_hours
            )
            VALUES ?
            ON DUPLICATE KEY UPDATE
                max_temperature = VALUES(max_temperature),
                min_temperature = VALUES(min_temperature),
                rainfall = VALUES(rainfall),
                relative_humidity_1 = VALUES(relative_humidity_1),
                relative_humidity_2 = VALUES(relative_humidity_2),
                vapour_pressure_1 = VALUES(vapour_pressure_1),
                vapour_pressure_2 = VALUES(vapour_pressure_2),
                wind_speed = VALUES(wind_speed),
                evaporation = VALUES(evaporation),
                sunshine_hours = VALUES(sunshine_hours),
                update_datetime = CURRENT_TIMESTAMP
        `;

        const values = observations.map(item => [
            item.station_id,
            item.observation_date,
            item.max_temperature ?? null,
            item.min_temperature ?? null,
            item.rainfall ?? null,
            item.relative_humidity_1 ?? null,
            item.relative_humidity_2 ?? null,
            item.vapour_pressure_1 ?? null,
            item.vapour_pressure_2 ?? null,
            item.wind_speed ?? null,
            item.evaporation ?? null,
            item.sunshine_hours ?? null,
        ]);

        await connection.query(sql, [values]);

        await connection.commit();

        return res.status(200).json({
            success: true,
            message: `${observations.length} observation(s) saved successfully`,
        });

    } catch (error) {
        await connection.rollback();

        console.error(
            "Failed to bulk upsert weather observations:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to save weather observations",
        });

    } finally {
        connection.release();
    }
};

export const getExistingObservationOptions = async (req, res) => {
    try {
        const stationId = Number(req.query.stationId);
        const year = Number(req.query.year);
        const month = Number(req.query.month);

        // Validate station
        if (
            !Number.isInteger(stationId) ||
            stationId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid stationId",
            });
        }

        // Validate year
        if (
            !Number.isInteger(year) ||
            year <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid year",
            });
        }

        // Validate month
        if (
            !Number.isInteger(month) ||
            month < 1 ||
            month > 12
        ) {
            return res.status(400).json({
                success: false,
                message: "Month must be between 1 and 12",
            });
        }

        const previousYears = [
            year - 1,
            year - 2,
        ];

        const [rows] = await pool.query(
            `
            SELECT DISTINCT
                YEAR(observation_date) AS year
            FROM weather_observation
            WHERE station_id = ?
              AND MONTH(observation_date) = ?
              AND YEAR(observation_date) IN (?)
            ORDER BY YEAR(observation_date) DESC
            `,
            [
                stationId,
                month,
                previousYears,
            ]
        );

        return res.status(200).json({
            success: true,
            data: rows.map(row => ({
                month,
                year: Number(row.year),
            })),
        });

    } catch (error) {
        console.error(
            "Failed to fetch existing observation options:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch existing observation options",
        });
    }
};

export const getObservations = async (req, res) => {
    try {
        const stationId = Number(req.query.stationId);
        const year = Number(req.query.year);
        const month = Number(req.query.month);

        // Validate stationId
        if (!Number.isInteger(stationId) || stationId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid stationId",
            });
        }

        // Validate year
        if (!Number.isInteger(year) || year <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid year",
            });
        }

        // Validate month
        if (!Number.isInteger(month) || month < 1 || month > 12) {
            return res.status(400).json({
                success: false,
                message: "Month must be between 1 and 12",
            });
        }

        const [rows] = await pool.query(
            `
            SELECT
                DATE_FORMAT(
                    observation_date,
                    '%Y-%m-%d'
                ) AS observation_date,
                max_temperature,
                min_temperature,
                rainfall,
                relative_humidity_1,
                relative_humidity_2,
                vapour_pressure_1,
                vapour_pressure_2,
                wind_speed,
                evaporation,
                sunshine_hours
            FROM weather_observation
            WHERE station_id = ?
              AND YEAR(observation_date) = ?
              AND MONTH(observation_date) = ?
            ORDER BY observation_date ASC
            `,
            [
                stationId,
                year,
                month,
            ]
        );

        const data = rows.map(row => ({
            key: row.observation_date,

            cells: {
                max_temperature: formatWeatherValue(row.max_temperature),
                min_temperature: formatWeatherValue(row.min_temperature),
                rainfall: formatWeatherValue(row.rainfall),
                relative_humidity_1: formatWeatherValue(row.relative_humidity_1),
                relative_humidity_2: formatWeatherValue(row.relative_humidity_2),
                vapour_pressure_1: formatWeatherValue(row.vapour_pressure_1),
                vapour_pressure_2: formatWeatherValue(row.vapour_pressure_2),
                wind_speed: formatWeatherValue(row.wind_speed),
                evaporation: formatWeatherValue(row.evaporation),
                sunshine_hours: formatWeatherValue(row.sunshine_hours),
            },
        }));

        return res.status(200).json({
            success: true,
            data,
        });

    } catch (error) {
        console.error(
            "Failed to fetch weather observations:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch weather observations",
        });
    }
};