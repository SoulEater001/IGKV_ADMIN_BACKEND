import { pool } from "../config/db.js";
import { formatWeatherValue, isValidIsoDate, validateObservation } from "../utils/weatherUtils.js";

export const bulkUpsertObservations = async (req, res) => {
    const { observations, observation_issue_date } = req.body;

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        if (!isValidIsoDate(observation_issue_date)) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Invalid observation_issue_date",
            });
        }

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
                observation_issue_date,
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
            observation_issue_date,
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
        const observationIssueDate = req.query.observationIssueDate;

        if (!Number.isInteger(stationId) || stationId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid stationId",
            });
        }

        if (!isValidIsoDate(observationIssueDate)) {
            return res.status(400).json({
                success: false,
                message: "Invalid observationIssueDate",
            });
        }

        const [yearString, monthString] =
            observationIssueDate.split("-");

        const year = Number(yearString);
        const month = Number(monthString);

        const years = [
            year,
            year - 1,
            year - 2,
        ];

        const [rows] = await pool.query(
            `
            SELECT
                YEAR(wo.observation_date) AS year,

                MONTH(wo.observation_date) AS month,

                DATE_FORMAT(
                    wo.observation_issue_date,
                    '%Y-%m-%d'
                ) AS observation_issue_date,

                DATE_FORMAT(
                    MIN(wo.observation_date),
                    '%Y-%m-%d'
                ) AS start_date,

                DATE_FORMAT(
                    MAX(wo.observation_date),
                    '%Y-%m-%d'
                ) AS end_date,

                COUNT(*) AS total_days,

                CASE
                    WHEN wos.id IS NOT NULL THEN true
                    ELSE false
                END AS summary_exists

            FROM weather_observation wo

            LEFT JOIN weather_observation_summary wos
                ON wos.station_id = wo.station_id
                AND wos.observation_issue_date =
                    wo.observation_issue_date

            WHERE wo.station_id = ?
              AND MONTH(wo.observation_date) = ?
              AND YEAR(wo.observation_date) IN (?)

            GROUP BY
                YEAR(wo.observation_date),
                MONTH(wo.observation_date),
                wo.observation_issue_date,
                wos.id

            ORDER BY
                YEAR(wo.observation_date) DESC,
                wo.observation_issue_date DESC
            `,
            [
                stationId,
                month,
                years,
            ]
        );

        const data = rows.map(row => ({
            year: Number(row.year),
            month: Number(row.month),
            observation_issue_date: row.observation_issue_date,
            start_date: row.start_date,
            end_date: row.end_date,
            total_days: Number(row.total_days),
            summary_exists: Boolean(row.summary_exists),
        }));

        return res.status(200).json({
            success: true,
            data,
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

        const observationIssueDates =
            req.query.observationIssueDates
                ? req.query.observationIssueDates
                    .split(",")
                    .map(date => date.trim())
                    .filter(Boolean)
                : [];

        // Validate stationId
        if (!Number.isInteger(stationId) || stationId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid stationId",
            });
        }

        // Validate observation issue dates
        if (observationIssueDates.length === 0) {
            return res.status(400).json({
                success: false,
                message:
                    "At least one observation issue date is required",
            });
        }

        // Get observation data
        const [observationRows] = await pool.query(
            `
            SELECT
                DATE_FORMAT(
                    observation_issue_date,
                    '%Y-%m-%d'
                ) AS observation_issue_date,

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
              AND observation_issue_date IN (?)

            ORDER BY
                observation_issue_date ASC,
                observation_date ASC
            `,
            [
                stationId,
                observationIssueDates,
            ]
        );

        // Get summary content
        const [summaryRows] = await pool.query(
            `
            SELECT
                DATE_FORMAT(
                    observation_issue_date,
                    '%Y-%m-%d'
                ) AS observation_issue_date,

                summary_en,
                summary_hi

            FROM weather_observation_summary

            WHERE station_id = ?
              AND observation_issue_date IN (?)
            `,
            [
                stationId,
                observationIssueDates,
            ]
        );

        // Format observation rows
        const observations = observationRows.map(row => ({
            observation_issue_date:
                row.observation_issue_date,

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

        // Format summaries
        const summaries = summaryRows.map(row => ({
            observation_issue_date: row.observation_issue_date,
            summary_en: row.summary_en,
            summary_hi: row.summary_hi,
        }));
        // console.log("Data", observations, summaries)

        return res.status(200).json({
            success: true,

            data: {
                observations,
                summaries,
            },
        });


    } catch (error) {
        console.error("Failed to fetch weather observations:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch weather observations",
        });
    }
};

export const upsertWeatherObservationSummary = async (req, res) => {
    try {
        const {
            stationId,
            observationIssueDate,
            summary_en,
            summary_hi,
            reuse_existing,
        } = req.body;

        if (!stationId || !observationIssueDate) {
            return res.status(400).json({
                success: false,
                message:
                    "stationId and observationIssueDate are required",
            });
        }

        // If existing summary is being reused,
        // do not insert or update anything
        if (reuse_existing === true) {
            return res.status(200).json({
                success: true,
                message: "Existing weather observation summary reused",
            });
        }

        const query = `
            INSERT INTO weather_observation_summary (
                station_id,
                observation_issue_date,
                summary_en,
                summary_hi
            )
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                summary_en = VALUES(summary_en),
                summary_hi = VALUES(summary_hi)
        `;

        await pool.query(query, [
            stationId,
            observationIssueDate,
            summary_en || null,
            summary_hi || null,
        ]);

        return res.status(200).json({
            success: true,
            message: "Weather observation summary saved successfully",
        });

    } catch (error) {
        console.error(
            "Error saving weather observation summary:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to save weather observation summary",
        });
    }
};

export const checkObservationAvailability = async (req, res) => {
    try {
        const {
            station_id,
            observation_issue_date,
        } = req.query;

        if (!station_id || !observation_issue_date) {
            return res.status(400).json({
                success: false,
                message:
                    "station_id and observation_issue_date are required.",
            });
        }

        const stationId = Number(station_id);

        if (
            !Number.isInteger(stationId) ||
            stationId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "station_id must be a valid positive integer.",
            });
        }

        const [
            [observationRows],
            [summaryRows],
        ] = await Promise.all([
            pool.query(
                `
                SELECT COUNT(*) AS row_count
                FROM weather_observation
                WHERE station_id = ?
                  AND observation_issue_date = ?
                `,
                [
                    stationId,
                    observation_issue_date,
                ]
            ),

            pool.query(
                `
                SELECT id
                FROM weather_observation_summary
                WHERE station_id = ?
                  AND observation_issue_date = ?
                LIMIT 1
                `,
                [
                    stationId,
                    observation_issue_date,
                ]
            ),
        ]);

        const rowCount = Number(
            observationRows[0].row_count
        );

        const summaryAvailable =
            summaryRows.length > 0;

        return res.status(200).json({
            success: true,
            data: {
                observations: {
                    available: rowCount > 0,
                    row_count: rowCount,
                },

                summary: {
                    available: summaryAvailable,
                },
            },
        });

    } catch (error) {
        console.error(
            "Observation availability error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to check observation availability.",
        });
    }
};