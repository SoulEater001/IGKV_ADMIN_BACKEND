// import { pool } from "../../../config/db.js";
import { pool } from "#config/db";
import type { WeatherPdfStationContext } from "../types/weather-pdf.types.ts";

export class WeatherPdfRepository {

  async getStation(stationId: number): Promise<WeatherPdfStationContext | null> {
    const [rows] = await pool.query(
      `
      SELECT
        id,
        station_name,
        station_code,
        state_lg_code,
        district_lg_code,
        block_lg_code
      FROM weather_station
      WHERE id = ?
        AND is_active = 1
      LIMIT 1
      `,
      [stationId]
    );

    const stations = rows as WeatherPdfStationContext[];

    return stations[0] ?? null;
  }

  async getObservationIssueDates(
    stationId: number,
    year: number | null,
    month: number | null
  ) {

    const conditions = [
      'o.station_id = ?'
    ];

    const params: any[] = [
      stationId
    ];

    if (year != null) {
      conditions.push(
        'YEAR(o.observation_issue_date) = ?'
      );
      params.push(year);
    }

    if (month != null) {
      conditions.push(
        'MONTH(o.observation_issue_date) = ?'
      );
      params.push(month);
    }

    const [rows] = await pool.query(
      `
    SELECT
     DATE_FORMAT(o.observation_issue_date, '%Y-%m-%d') AS issue_date,
DATE_FORMAT(MIN(o.observation_date), '%Y-%m-%d') AS from_date,
DATE_FORMAT(MAX(o.observation_date), '%Y-%m-%d') AS end_date
    FROM weather_observation o
    WHERE ${conditions.join(' AND ')}
    GROUP BY o.observation_issue_date
    ORDER BY o.observation_issue_date DESC
    `,
      params
    );

    return (rows as any[]).map(row => ({
      issueDate: row.issue_date,
      fromDate: row.from_date,
      endDate: row.end_date,
      stateLgCode: null,
      districtLgCode: null,
      blockLgCode: null
    }));
  }

  async getForecastIssueDates(
    stationId: number,
    year: number | null,
    month: number | null
  ) {

    const conditions = [
      'f.station_id = ?'
    ];

    const params: any[] = [
      stationId
    ];

    if (year != null) {
      conditions.push(
        'YEAR(f.forecast_issue_date) = ?'
      );
      params.push(year);
    }

    if (month != null) {
      conditions.push(
        'MONTH(f.forecast_issue_date) = ?'
      );
      params.push(month);
    }

    const [rows] = await pool.query(
      `
    SELECT
      DATE_FORMAT(f.forecast_issue_date, '%Y-%m-%d') AS issue_date,
      f.state_lg_code,
      f.district_lg_code,
      f.block_lg_code,
      DATE_FORMAT(MIN(f.forecast_date), '%Y-%m-%d') AS from_date,
      DATE_FORMAT(MAX(f.forecast_date), '%Y-%m-%d') AS end_date
    FROM weather_forecast f
    WHERE ${conditions.join(' AND ')}
    GROUP BY
      f.forecast_issue_date,
      f.state_lg_code,
      f.district_lg_code,
      f.block_lg_code
    ORDER BY
      f.forecast_issue_date DESC,
      f.state_lg_code,
      f.district_lg_code,
      f.block_lg_code
    `,
      params
    );

    return (rows as any[]).map(row => ({
      issueDate: row.issue_date,
      fromDate: row.from_date,
      endDate: row.end_date,
      stateLgCode: row.state_lg_code,
      districtLgCode: row.district_lg_code,
      blockLgCode: row.block_lg_code
    }));
  }

  async getWeatherAdvisoryIssueDates(
    stationId: number,
    year: number | null,
    month: number | null
  ) {
    const conditions = [
      'wf.station_id = ?'
    ];

    const params: any[] = [
      stationId
    ];

    if (year != null) {
      conditions.push(
        'YEAR(wf.forecast_issue_date) = ?'
      );
      params.push(year);
    }

    if (month != null) {
      conditions.push(
        'MONTH(wf.forecast_issue_date) = ?'
      );
      params.push(month);
    }

    const [rows] = await pool.query(
      `
    SELECT
      DATE_FORMAT(
        f.forecast_issue_date,
        '%Y-%m-%d'
      ) AS issue_date,

      f.state_lg_code,
      f.district_lg_code,
      f.block_lg_code,

      DATE_FORMAT(
        o.observation_from_date,
        '%Y-%m-%d'
      ) AS observation_from_date,

      DATE_FORMAT(
        o.observation_to_date,
        '%Y-%m-%d'
      ) AS observation_end_date,

      DATE_FORMAT(
        f.forecast_from_date,
        '%Y-%m-%d'
      ) AS forecast_from_date,

      DATE_FORMAT(
        f.forecast_to_date,
        '%Y-%m-%d'
      ) AS forecast_end_date

    FROM
    (
      SELECT
        wf.forecast_issue_date,
        wf.state_lg_code,
        wf.district_lg_code,
        wf.block_lg_code,

        MIN(wf.forecast_date) AS forecast_from_date,
        MAX(wf.forecast_date) AS forecast_to_date

      FROM weather_forecast wf

      WHERE ${conditions.join(' AND ')}

      GROUP BY
        wf.forecast_issue_date,
        wf.state_lg_code,
        wf.district_lg_code,
        wf.block_lg_code

    ) f

    INNER JOIN
    (
      SELECT
        observation_issue_date,

        MIN(observation_date)
          AS observation_from_date,

        MAX(observation_date)
          AS observation_to_date

      FROM weather_observation

      WHERE station_id = ?

      GROUP BY observation_issue_date

    ) o

      ON o.observation_issue_date =
         f.forecast_issue_date

    INNER JOIN
    (
      SELECT DISTINCT
        DATE(m.advisory_date) AS issue_date,
        d.state_lg_code,
        d.district_lg_code,
        d.block_lg_code

      FROM imd_advisory_main m

      INNER JOIN imd_advisory_detail d
        ON d.advisory_main_id = m.id

    ) a

      ON a.issue_date =
         f.forecast_issue_date

      AND a.state_lg_code =
          f.state_lg_code

      AND a.district_lg_code =
          f.district_lg_code

      AND (
        (
          a.block_lg_code IS NULL
          AND f.block_lg_code IS NULL
        )
        OR
        (
          a.block_lg_code IS NOT NULL
          AND a.block_lg_code = f.block_lg_code
        )
      )

    ORDER BY
      f.forecast_issue_date DESC,
      f.state_lg_code,
      f.district_lg_code,
      f.block_lg_code
    `,
      [
        ...params,
        stationId
      ]
    );

    return (rows as any[]).map(row => ({
      issueDate: row.issue_date,

      observationFromDate:
        row.observation_from_date,

      observationEndDate:
        row.observation_end_date,

      forecastFromDate:
        row.forecast_from_date,

      forecastEndDate:
        row.forecast_end_date,

      stateLgCode:
        row.state_lg_code,

      districtLgCode:
        row.district_lg_code,

      blockLgCode:
        row.block_lg_code
    }));
  }

  async getObservations(
    stationId: number,
    issueDate: string,
    fromDate?: string,
    toDate?: string
  ) {
    let query = `
    SELECT
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
    FROM weather_observation
    WHERE station_id = ?
      AND observation_issue_date = ?
  `;

    const params: any[] = [
      stationId,
      issueDate
    ];

    if (fromDate && toDate) {
      query += `
      AND observation_date BETWEEN ? AND ?
    `;

      params.push(
        fromDate,
        toDate
      );
    }

    query += `
    ORDER BY observation_date ASC
  `;

    const [rows] =
      await pool.query(
        query,
        params
      );

    return rows as any[];
  }

  async getForecasts(
    stationId: number,
    issueDate: string,
    stateLgCode: number,
    fromDate?: string,
    toDate?: string,
    districtLgCode?: number | null,
    blockLgCode?: number | null
  ) {

    const conditions = [
      'f.station_id = ?',
      'f.forecast_issue_date = ?',
      'f.state_lg_code = ?'
    ];

    const params: any[] = [
      stationId,
      issueDate,
      stateLgCode
    ];

    if (districtLgCode != null) {
      conditions.push(
        'f.district_lg_code = ?'
      );

      params.push(
        districtLgCode
      );
    }

    if (blockLgCode != null) {
      conditions.push(
        'f.block_lg_code = ?'
      );

      params.push(
        blockLgCode
      );
    }

    if (fromDate && toDate) {
      conditions.push(
        'f.forecast_date BETWEEN ? AND ?'
      );

      params.push(
        fromDate,
        toDate
      );
    }

    const [rows] = await pool.query(
      `
    SELECT
      f.forecast_date,
      f.rainfall,
      f.max_temperature,
      f.min_temperature,
      f.cloud_amount,
      f.relative_humidity_1,
      f.relative_humidity_2,
      f.wind_speed,
      f.wind_direction
    FROM weather_forecast f
    WHERE ${conditions.join(' AND ')}
    ORDER BY f.forecast_date ASC
    `,
      params
    );

    return rows as any[];
  }

  async getLocationNames(
    stateLgCode: number,
    districtLgCode: number | null,
    blockLgCode: number | null
  ) {
    const [rows] = await pool.query(
      `
    SELECT
      s.state_lg_code,

      se.name AS state_name_en,
      sh.name AS state_name_hi,

      d.district_lg_code,

      de.name AS district_name_en,
      dh.name AS district_name_hi,

      b.block_lg_code,

      be.name AS block_name_en,
      bh.name AS block_name_hi

    FROM m_state s

    LEFT JOIN m_state_language se
      ON se.state_id = s.state_id
      AND se.language_id = 2
      AND se.deleted IS NULL

    LEFT JOIN m_state_language sh
      ON sh.state_id = s.state_id
      AND sh.language_id = 1
      AND sh.deleted IS NULL

    LEFT JOIN m_district d
      ON d.state_id = s.state_id
      AND d.district_lg_code = ?
      AND d.deleted IS NULL

    LEFT JOIN m_district_language de
      ON de.district_id = d.district_id
      AND de.language_id = 2
      AND de.deleted IS NULL

    LEFT JOIN m_district_language dh
      ON dh.district_id = d.district_id
      AND dh.language_id = 1
      AND dh.deleted IS NULL

    LEFT JOIN m_block b
      ON b.district_id = d.district_id
      AND b.block_lg_code = ?
      AND b.deleted IS NULL

    LEFT JOIN m_block_language be
      ON be.block_id = b.block_id
      AND be.language_id = 2
      AND be.deleted IS NULL

    LEFT JOIN m_block_language bh
      ON bh.block_id = b.block_id
      AND bh.language_id = 1
      AND bh.deleted IS NULL

    WHERE s.state_lg_code = ?
      AND s.deleted IS NULL

    LIMIT 1
    `,
      [
        districtLgCode,
        blockLgCode,
        stateLgCode
      ]
    );

    return (rows as any[])[0] ?? null;
  }

  async getAdvisoryObservations(
    stationId: number,
    issueDate: string
  ) {
    const [rows] = await pool.query(
      `
    SELECT
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
    FROM weather_observation
    WHERE station_id = ?
      AND observation_issue_date = ?
    ORDER BY observation_date
    `,
      [
        stationId,
        issueDate
      ]
    );

    return rows as any[];
  }

  async getObservationSummary(
    stationId: number,
    issueDate: string
  ) {
    const [rows] = await pool.query(
      `
    SELECT
      summary_en,
      summary_hi
    FROM weather_observation_summary
    WHERE station_id = ?
      AND observation_issue_date = ?
    LIMIT 1
    `,
      [
        stationId,
        issueDate
      ]
    );

    return (rows as any[])[0] ?? null;
  }
  async getForecastSummary(
    issueDate: string,
    stateLgCode: number,
    districtLgCode: number | null = null,
    blockLgCode: number | null = null
  ) {
    const [rows] = await pool.query(
      `
    SELECT
      summary_en,
      summary_hi
    FROM weather_forecast_summary
    WHERE forecast_issue_date = ?
      AND state_lg_code = ?
      AND (
        district_lg_code = ?
        OR (
          ? IS NULL
          AND district_lg_code IS NULL
        )
      )
      AND (
        block_lg_code = ?
        OR (
          ? IS NULL
          AND block_lg_code IS NULL
        )
      )
    ORDER BY id DESC
    LIMIT 1
    `,
      [
        issueDate,
        stateLgCode,
        districtLgCode,
        districtLgCode,
        blockLgCode,
        blockLgCode
      ]
    );

    return (rows as any[])[0] ?? null;
  }

  async getAdvisories(
    issueDate: string,
    stateLgCode: number,
    districtLgCode: number | null = null,
    blockLgCode: number | null = null,
    languageId: number
  ) {
    const categoryColumn =
      languageId === 1
        ? 'c.imd_category_name_h'
        : 'c.img_category_name';

    const cropColumn =
      languageId === 1
        ? 'cr.imd_crop_name_h'
        : 'cr.imd_crop_name';

    const cropStageColumn =
      languageId === 1
        ? 'cs.stage_name_h'
        : 'cs.stage_name';

    const advisoryTypeColumn =
      languageId === 1
        ? 'at.imd_advisory_type_name_h'
        : 'at.imd_advisory_type_name';

    const [rows] = await pool.query(
      `
    SELECT
      m.id AS advisory_main_id,
      m.advisory_main_id AS external_advisory_main_id,
      m.advisory_date,

      d.id AS advisory_detail_id,
      d.advisory_detail_id,

      d.cat_id,
      ${categoryColumn} AS category_name,

      d.crop_id,
       ${cropColumn} AS crop_name,

      d.crop_stage_id,
      ${cropStageColumn} AS crop_stage_name,

      d.advisory_type_id,
      ${advisoryTypeColumn} AS advisory_type_name,

      d.advisory,
      d.language_Id,
      d.block_lg_code,
      d.district_lg_code,
      d.state_lg_code

    FROM imd_advisory_main m

    INNER JOIN imd_advisory_detail d
      ON d.advisory_main_id = m.id

    LEFT JOIN imd_m_category c
      ON c.id = d.cat_id

    LEFT JOIN imd_m_crop cr
      ON cr.id = d.crop_id

    LEFT JOIN crop_stages cs
      ON cs.id = d.crop_stage_id

    LEFT JOIN imd_advisory_type at
      ON at.id = d.advisory_type_id

    WHERE DATE(m.advisory_date) = ?

      AND d.language_Id = ?

      AND d.state_lg_code = ?

      AND (
        d.district_lg_code = ?
        OR (
          ? IS NULL
          AND d.district_lg_code IS NULL
        )
      )

      AND (
        d.block_lg_code = ?
        OR (
          ? IS NULL
          AND d.block_lg_code IS NULL
        )
      )

    ORDER BY
      d.cat_id,
      d.crop_id,
      d.crop_stage_id,
      d.advisory_type_id,
      d.id
    `,
      [
        issueDate,
        languageId,
        stateLgCode,
        districtLgCode,
        districtLgCode,
        blockLgCode,
        blockLgCode
      ]
    );
    // console.log('Rows : ', rows)
    return rows as any[];
  }
}