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

export const getExistingForecastOptions = async (req, res) => {
    try {
        const stationId = Number(req.query.station_id);
        const issueDate = req.query.issue_date;

        if (!Number.isInteger(stationId) || stationId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid station_id",
            });
        }

        if (!isValidIsoDate(issueDate)) {
            return res.status(400).json({
                success: false,
                message: "Invalid issue_date",
            });
        }

        const [selectedYear, selectedMonth] =
            issueDate.split("-").map(Number);

        const years = [
            selectedYear,
            selectedYear - 1,
        ];

        const [rows] = await pool.query(
            `
            SELECT
                YEAR(wf.forecast_date) AS year,

                MONTH(wf.forecast_date) AS month,

                DATE_FORMAT(
                    wf.forecast_issue_date,
                    '%Y-%m-%d'
                ) AS forecast_issue_date,

                wf.state_lg_code,
                wf.district_lg_code,
                wf.block_lg_code,

                DATE_FORMAT(
                    MIN(wf.forecast_date),
                    '%Y-%m-%d'
                ) AS start_date,

                DATE_FORMAT(
                    MAX(wf.forecast_date),
                    '%Y-%m-%d'
                ) AS end_date,

                COUNT(*) AS total_days,

                CASE
                    WHEN wfs.id IS NOT NULL THEN true
                    ELSE false
                END AS summary_exists

            FROM weather_forecast wf

            LEFT JOIN weather_forecast_summary wfs
                ON wfs.forecast_issue_date =
                    wf.forecast_issue_date
                AND wfs.state_lg_code =
                    wf.state_lg_code
                AND wfs.district_lg_code =
                    wf.district_lg_code
                AND wfs.block_lg_code =
                    wf.block_lg_code

            WHERE wf.station_id = ?
              AND MONTH(wf.forecast_date) = ?
              AND YEAR(wf.forecast_date) IN (?)

            GROUP BY
                YEAR(wf.forecast_date),
                MONTH(wf.forecast_date),
                wf.forecast_issue_date,
                wf.state_lg_code,
                wf.district_lg_code,
                wf.block_lg_code,
                wfs.id

            ORDER BY
                YEAR(wf.forecast_date) DESC,
                wf.forecast_issue_date DESC
            `,
            [
                stationId,
                selectedMonth,
                years,
            ]
        );

        const data = rows.map(row => ({
            year: Number(row.year),
            month: Number(row.month),

            forecast_issue_date: row.forecast_issue_date,

            state_lg_code:
                row.state_lg_code !== null
                    ? Number(row.state_lg_code)
                    : null,

            district_lg_code:
                row.district_lg_code !== null
                    ? Number(row.district_lg_code)
                    : null,

            block_lg_code:
                row.block_lg_code !== null
                    ? Number(row.block_lg_code)
                    : null,

            start_date: row.start_date,
            end_date: row.end_date,

            total_days: Number(row.total_days),

            summary_exists: Boolean(row.summary_exists),
        }));
        // console.log("forecast option : ", data)

        return res.status(200).json({
            success: true,
            data,
        });

    } catch (error) {
        console.error(
            "Failed to fetch existing forecast options:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to fetch existing forecast options",
        });
    }
};

export const getForecastsWithOptions = async (req, res) => {
    try {
        const stationId = Number(req.query.station_id);

        if (!Number.isInteger(stationId) || stationId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid station_id",
            });
        }

        let forecastOptions = [];

        try {
            forecastOptions = req.query.forecastOptions
                ? JSON.parse(req.query.forecastOptions)
                : [];
        } catch {
            return res.status(400).json({
                success: false,
                message: "Invalid forecastOptions",
            });
        }

        if (
            !Array.isArray(forecastOptions) ||
            forecastOptions.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "At least one forecast option is required",
            });
        }

        // ------------------------------------------
        // Validate forecast options
        // ------------------------------------------

        for (const option of forecastOptions) {
            if (!isValidIsoDate(option.issueDate)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid forecast issue date",
                });
            }

            // State and district are required.
            // Block can be NULL.
            if (
                option.stateLgCode == null ||
                option.districtLgCode == null
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "State and district LG codes are required",
                });
            }
        }

        // ------------------------------------------
        // Build forecast scope conditions
        // ------------------------------------------

        const conditions = [];
        const queryParams = [stationId];

        for (const option of forecastOptions) {
            let condition = `
                (
                    forecast_issue_date = ?
                    AND state_lg_code = ?
                    AND district_lg_code = ?
            `;

            queryParams.push(
                option.issueDate,
                option.stateLgCode,
                option.districtLgCode
            );

            if (option.blockLgCode == null) {
                condition += `
                    AND block_lg_code IS NULL
                `;
            } else {
                condition += `
                    AND block_lg_code = ?
                `;

                queryParams.push(option.blockLgCode);
            }

            condition += `
                )
            `;

            conditions.push(condition);
        }

        // ------------------------------------------
        // Fetch forecasts
        // ------------------------------------------

        const [rows] = await pool.query(
            `
            SELECT
                DATE_FORMAT(
                    forecast_issue_date,
                    '%Y-%m-%d'
                ) AS forecast_issue_date,

                DATE_FORMAT(
                    forecast_date,
                    '%Y-%m-%d'
                ) AS forecast_date,

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

            FROM weather_forecast

            WHERE station_id = ?
              AND (
                ${conditions.join(" OR ")}
              )

            ORDER BY
                forecast_issue_date ASC,
                forecast_date ASC
            `,
            queryParams
        );

        const summaryConditions = [];
        const summaryParams = [];

        for (const option of forecastOptions) {
            let condition = `
        (
            forecast_issue_date = ?
            AND state_lg_code = ?
            AND district_lg_code = ?
    `;

            summaryParams.push(
                option.issueDate,
                option.stateLgCode,
                option.districtLgCode
            );

            if (option.blockLgCode == null) {
                condition += `
            AND block_lg_code IS NULL
        `;
            } else {
                condition += `
            AND block_lg_code = ?
        `;

                summaryParams.push(option.blockLgCode);
            }

            condition += `)`;

            summaryConditions.push(condition);
        }

        const [summaryRows] = await pool.query(
            `
    SELECT
        DATE_FORMAT(
            forecast_issue_date,
            '%Y-%m-%d'
        ) AS forecast_issue_date,

        state_lg_code,
        district_lg_code,
        block_lg_code,

        summary_en,
        summary_hi

    FROM weather_forecast_summary

    WHERE
        ${summaryConditions.join(" OR ")}
    `,
            summaryParams
        );


        // ------------------------------------------
        // Format response
        // ------------------------------------------

        const summaries = summaryRows.map(row => ({
            forecast_issue_date: row.forecast_issue_date,
            state_lg_code:
                row.state_lg_code !== null
                    ? Number(row.state_lg_code)
                    : null,

            district_lg_code:
                row.district_lg_code !== null
                    ? Number(row.district_lg_code)
                    : null,

            block_lg_code:
                row.block_lg_code !== null
                    ? Number(row.block_lg_code)
                    : null,
            summary_en: row.summary_en,
            summary_hi: row.summary_hi,

        }));

        const data = rows.map(row => ({
            forecast_issue_date:
                row.forecast_issue_date,

            state_lg_code:
                row.state_lg_code !== null
                    ? Number(row.state_lg_code)
                    : null,

            district_lg_code:
                row.district_lg_code !== null
                    ? Number(row.district_lg_code)
                    : null,

            block_lg_code:
                row.block_lg_code !== null
                    ? Number(row.block_lg_code)
                    : null,

            key: row.forecast_date,

            cells: {
                rainfall:
                    formatWeatherValue(row.rainfall),

                max_temperature:
                    formatWeatherValue(row.max_temperature),

                min_temperature:
                    formatWeatherValue(row.min_temperature),

                cloud_amount:
                    formatWeatherValue(row.cloud_amount),

                relative_humidity_1:
                    formatWeatherValue(row.relative_humidity_1),

                relative_humidity_2:
                    formatWeatherValue(row.relative_humidity_2),

                wind_speed:
                    formatWeatherValue(row.wind_speed),

                wind_direction: row.wind_direction ?? '',
            },
        }));

        // console.log("previous forecast data :",data, summaries)

        return res.status(200).json({
            success: true,
            data,
            summaries
        });

    } catch (error) {
        console.error(
            "Failed to fetch weather forecasts:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to fetch weather forecasts",
        });
    }
};

export const upsertWeatherForecastSummary = async (req, res) => {
    try {
        const {
            advisoryMainId,
            state_lg_code,
            district_lg_code,
            block_lg_code,
            summary_en,
            summary_hi,
        } = req.body;

        if (!advisoryMainId || !state_lg_code) {
            return res.status(400).json({
                success: false,
                message:
                    "advisoryMainId and state_lg_code are required",
            });
        }

        const query = `
      INSERT INTO weather_forecast_summary (
        advisory_main_id,
        state_lg_code,
        district_lg_code,
        block_lg_code,
        summary_en,
        summary_hi
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        summary_en = VALUES(summary_en),
        summary_hi = VALUES(summary_hi)
    `;

        await pool.query(query, [
            advisoryMainId,
            state_lg_code,
            district_lg_code ?? null,
            block_lg_code ?? null,
            summary_en ?? null,
            summary_hi ?? null,
        ]);

        return res.status(200).json({
            success: true,
            message: "Weather forecast summary saved successfully",
        });

    } catch (error) {
        console.error(
            "Error saving weather forecast summary:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to save weather forecast summary",
        });
    }
};