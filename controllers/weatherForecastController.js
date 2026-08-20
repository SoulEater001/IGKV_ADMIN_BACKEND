import { pool } from "../config/db.js";
import { formatWeatherValue, isValidIsoDate, validateForecast } from "../utils/weatherUtils.js";
import validateLocationHierarchy from "../utils/validateLocationHierarchy.js";

export const bulkUpsertForecasts = async (req, res) => {
    const { forecasts } = req.body;

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        if (!Array.isArray(forecasts)) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "forecasts must be an array",
            });
        }

        if (forecasts.length === 0) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "No forecasts provided",
            });
        }

        const invalidStationId = forecasts.some(
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
                forecasts.map(item => Number(item.station_id))
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

        const invalidIssueDate = forecasts.some(
            item => !isValidIsoDate(item.forecast_issue_date)
        );

        if (invalidIssueDate) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Invalid forecast issue date",
            });
        }

        const invalidForecastDate = forecasts.some(
            item => !isValidIsoDate(item.forecast_date)
        );

        if (invalidForecastDate) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Invalid forecast date",
            });
        }

        const normalizeLgCode = value => {
            if (
                value === null ||
                value === undefined ||
                value === ''
            ) {
                return null;
            }

            const parsed = Number(value);

            return Number.isInteger(parsed)
                ? parsed
                : value;
        };

        forecasts.forEach(item => {
            item.state_lg_code =
                normalizeLgCode(item.state_lg_code);

            item.district_lg_code =
                normalizeLgCode(item.district_lg_code);

            item.block_lg_code =
                normalizeLgCode(item.block_lg_code);
        });

        const invalidTargetLocation = forecasts.some(item =>
            !validateLocationHierarchy(
                item.state_lg_code,
                item.district_lg_code,
                item.block_lg_code
            )
        );

        if (invalidTargetLocation) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Invalid target location hierarchy. " +
                    "Valid combinations are state, state + district, or state + district + block.",
            });
        }

        for (let i = 0; i < forecasts.length; i++) {
            const error = validateForecast(forecasts[i]);

            if (error) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message: `Invalid forecast at index ${i}: ${error}`,
                });
            }
        }

        const sql = `
            INSERT INTO weather_forecast (
                station_id,
                forecast_issue_date,
                forecast_date,
                state_lg_code,
                district_lg_code,
                block_lg_code,
                rainfall,
                max_temperature,
                min_temperature,
                cloud_amount,
                relative_humidity_1,
                relative_humidity_2,
                wind_speed,
                wind_direction
            )
            VALUES ?
            ON DUPLICATE KEY UPDATE
                rainfall = VALUES(rainfall),
                max_temperature = VALUES(max_temperature),
                min_temperature = VALUES(min_temperature),
                cloud_amount = VALUES(cloud_amount),
                relative_humidity_1 = VALUES(relative_humidity_1),
                relative_humidity_2 = VALUES(relative_humidity_2),
                wind_speed = VALUES(wind_speed),
                wind_direction = VALUES(wind_direction),
                update_datetime = CURRENT_TIMESTAMP
        `;

        const values = forecasts.map(item => [
            item.station_id,
            item.forecast_issue_date,
            item.forecast_date,
            item.state_lg_code,
            item.district_lg_code,
            item.block_lg_code,
            item.rainfall ?? null,
            item.max_temperature ?? null,
            item.min_temperature ?? null,
            item.cloud_amount ?? null,
            item.relative_humidity_1 ?? null,
            item.relative_humidity_2 ?? null,
            item.wind_speed ?? null,
            item.wind_direction ?? null,
        ]);

        await connection.query(sql, [values]);

        await connection.commit();

        return res.status(200).json({
            success: true,
            message: `${forecasts.length} forecast(s) saved successfully`,
        });

    } catch (error) {
        await connection.rollback();

        console.error(
            "Failed to bulk upsert weather forecasts:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to save weather forecasts",
        });

    } finally {
        connection.release();
    }
};

export const getExistingForecastOptions = async (req, res) => {
    try {
        const stationId = Number(req.query.station_id);
        const issueDate = req.query.issue_date;

        // Validate station
        if (!Number.isInteger(stationId) || stationId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid station_id",
            });
        }

        // Validate issue date
        if (!isValidIsoDate(issueDate)) {
            return res.status(400).json({
                success: false,
                message: "Invalid issue_date",
            });
        }

        const selectedDate = new Date(
            `${issueDate}T00:00:00`
        );

        const selectedYear = selectedDate.getFullYear();
        const selectedMonth =
            selectedDate.getMonth() + 1;

        // Example:
        // Selected: July 2026
        // Search: July 2025
        const previousYear = selectedYear - 1;

        const [rows] = await pool.query(
            `
            SELECT DISTINCT
                DATE_FORMAT(
                    forecast_date,
                    '%Y-%m-%d'
                ) AS forecast_date,
                 DATE_FORMAT(
                    forecast_issue_date,
                    '%Y-%m-%d'
                ) AS issue_date
            FROM weather_forecast
            WHERE station_id = ?
              AND MONTH(forecast_date) = ?
              AND YEAR(forecast_date) = ?
            ORDER BY forecast_date ASC
            `,
            [
                stationId,
                selectedMonth,
                previousYear,
            ]
        );

        return res.status(200).json({
            success: true,
            data: rows.map(row => ({
                issue_date: row.issue_date,
                forecast_date: row.forecast_date,
            })),
        });

    } catch (error) {
        console.error(
            "Failed to fetch existing forecast options:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch existing forecast options",
        });
    }
};

export const getForecasts = async (req, res) => {
    try {
        const stationId = Number(req.query.station_id);
        const rawForecastDates = req.query.forecast_dates;

        const forecastDates = Array.isArray(rawForecastDates)
            ? rawForecastDates.filter(Boolean)
            : typeof rawForecastDates === 'string'
                ? rawForecastDates.split(',').filter(Boolean)
                : [];

        // Validate station
        if (
            !Number.isInteger(stationId) ||
            stationId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid station_id",
            });
        }

        // Validate issue date
        if (!forecastDates?.length || forecastDates.some(date => !isValidIsoDate(date))
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid forecast_dates",
            });
        }

        const placeholders = forecastDates.map(() => '?').join(',');

        const [rows] = await pool.query(
            `
            SELECT
                DATE_FORMAT(
                    forecast_date,
                    '%Y-%m-%d'
                ) AS forecast_date,

                rainfall,
                max_temperature,
                min_temperature,
                cloud_amount,
                relative_humidity_1,
                relative_humidity_2,
                wind_speed,
                wind_direction

            FROM weather_forecast
            WHERE station_id = ?
              AND forecast_date IN (${placeholders})
            ORDER BY forecast_date ASC
            `,
            [
                stationId,
                ...forecastDates
            ]
        );

        const data = rows.map(row => ({
            key: row.forecast_date,

            cells: {
                rainfall: formatWeatherValue(row.rainfall),
                max_temperature: formatWeatherValue(row.max_temperature),
                min_temperature: formatWeatherValue(row.min_temperature),
                cloud_amount: formatWeatherValue(row.cloud_amount),
                relative_humidity_1: formatWeatherValue(row.relative_humidity_1),
                relative_humidity_2: formatWeatherValue(row.relative_humidity_2),
                wind_speed: formatWeatherValue(row.wind_speed),
                wind_direction: row.wind_direction ?? '',
            }
        }));
        // console.log(data)

        return res.status(200).json({
            success: true,
            data,
        });

    } catch (error) {
        console.error(
            "Failed to fetch weather forecasts:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch weather forecasts",
        });
    }
};

export const getForecastsWithOptions = async (req, res) => {
    try {
        const stationId = Number(req.query.station_id);
        const rawSelections = req.query.selections;
        let selections;
        try {
            selections = JSON.parse(rawSelections ?? '[]');
        } catch {
            return res.status(400).json({
                success: false,
                message: 'Invalid selections format',
            });
        }

        if (
            !Number.isInteger(stationId) ||
            stationId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid station_id',
            });
        }

        if (
            !Array.isArray(selections) ||
            !selections.length
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid forecast selections',
            });
        }

        for (const selection of selections) {
            if (
                !isValidIsoDate(selection.issueDate) ||
                !isValidIsoDate(selection.forecastDate)
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid forecast selection',
                });
            }
        }

        const conditions = selections
            .map(() => `
        (
          forecast_issue_date = ?
          AND forecast_date = ?
        )
      `)
            .join(' OR ');

        const values = selections.flatMap(selection => [
            selection.issueDate,
            selection.forecastDate,
        ]);

        const [rows] = await pool.query(
            `
      SELECT
        DATE_FORMAT(
          forecast_issue_date,
          '%Y-%m-%d'
        ) AS issue_date,

        DATE_FORMAT(
          forecast_date,
          '%Y-%m-%d'
        ) AS forecast_date,

        rainfall,
        max_temperature,
        min_temperature,
        cloud_amount,
        relative_humidity_1,
        relative_humidity_2,
        wind_speed,
        wind_direction

      FROM weather_forecast

      WHERE station_id = ?
        AND (
          ${conditions}
        )

      ORDER BY
        forecast_issue_date DESC,
        forecast_date ASC
      `,
            [
                stationId,
                ...values,
            ]
        );

        const data = rows.map(row => ({
            key: row.forecast_date,

            cells: {
                rainfall: formatWeatherValue(row.rainfall),
                max_temperature: formatWeatherValue(
                    row.max_temperature
                ),
                min_temperature: formatWeatherValue(
                    row.min_temperature
                ),
                cloud_amount: formatWeatherValue(
                    row.cloud_amount
                ),
                relative_humidity_1: formatWeatherValue(
                    row.relative_humidity_1
                ),
                relative_humidity_2: formatWeatherValue(
                    row.relative_humidity_2
                ),
                wind_speed: formatWeatherValue(
                    row.wind_speed
                ),
                wind_direction:
                    row.wind_direction ?? '',
            },
        }));

        return res.status(200).json({
            success: true,
            data,
        });

    } catch (error) {
        console.error(
            'Failed to fetch weather forecasts:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                'Failed to fetch weather forecasts',
        });
    }
};