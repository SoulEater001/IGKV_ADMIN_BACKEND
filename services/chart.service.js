import { digitalAgriPool } from "../config/digitalAgriDb.js";
import {
  CropDistributionDTO,
  DistrictDistributionDTO,
  DistrictCropHeatmapDTO,
  DistrictCropDTO,
} from "../models/chart.dto.js";

async function getCropDistribution() {
  const query = `
    SELECT
      cd.crop_code AS cropCode,
      mc.crop_name AS cropName,
      COUNT(DISTINCT f.uf_id) AS farmerCount
    FROM mas_farmer f
    JOIN land_details ld
      ON f.uf_id = ld.uf_id
    JOIN crop_details cd
      ON cd.id_masterkey_khasra = ld.id_masterkey_khasra
    JOIN mas_crop mc
      ON mc.crop_code = cd.crop_code
    GROUP BY
      cd.crop_code,
      mc.crop_name
    ORDER BY farmerCount DESC;
  `;

  try {
    const [rows] = await digitalAgriPool.query(query);

    return rows.map(
      (row) =>
        new CropDistributionDTO(
          Number(row.cropCode),
          row.cropName,
          Number(row.farmerCount) || 0
        )
    );
  } catch (err) {
    console.error("[ChartService:getCropDistribution] Error:", err.message);
    throw new Error("Database query failed");
  }
}

async function getDistrictDistribution(cropCode = null) {
  const params = [];
  // console.log(cropCode)
  let cropFilter = '';

  if (cropCode !== null && cropCode !== undefined) {
    cropFilter = `
      AND cd.crop_code = ?
    `;

    params.push(cropCode);
  }

  const query = `
    SELECT
      d.Rev_district_id AS districtId,
      d.District_Name_Eng AS districtName,

      COALESCE(SUM(cd.crop_area), 0) AS cropArea,

      COALESCE(
        SUM(cd.crop_area * 19),
        0
      ) AS cropProduction

    FROM mas_districts d

    LEFT JOIN mas_villages v
      ON v.distno = d.Rev_district_id

    LEFT JOIN mas_farmer f
      ON f.village_code = v.vsr_census

    LEFT JOIN land_details ld
      ON ld.uf_id = f.uf_id

    LEFT JOIN crop_details cd
      ON cd.id_masterkey_khasra = ld.id_masterkey_khasra
      ${cropFilter}

    GROUP BY
      d.Rev_district_id,
      d.District_Name_Eng
    
    HAVING
      COALESCE(SUM(cd.crop_area), 0) > 0

    ORDER BY cropProduction DESC;
  `;

  try {
    const [rows] = await digitalAgriPool.query(query, params);

    return rows.map(
      (row) =>
        new DistrictDistributionDTO(
          Number(row.districtId),
          row.districtName,
          Number(row.cropArea) || 0,
          Number(row.cropProduction) || 0
        )
    );
  } catch (err) {
    console.error(
      '[ChartService:getDistrictDistribution] Error:',
      err.message
    );

    throw new Error('Database query failed');
  }
}

async function getCropCountHeatmap() {
  const query = `
    SELECT
      d.Rev_district_id AS districtId,
      d.District_Name_Eng AS districtName,

      COALESCE(land_totals.totalArea, 0) AS totalArea,
      COALESCE(production_totals.totalProduction, 0) AS totalProduction,

      c.cropCode,
      c.cropName,

      COALESCE(c.cropCount, 0) AS cropCount,
      COALESCE(c.cropArea, 0) AS cropArea,
      COALESCE(c.cropProduction, 0) AS cropProduction

    FROM mas_districts d

    /* ============================================================
       TOTAL DISTRICT LAND AREA
       IMPORTANT:
       No crop_details join here.
       Therefore land_area cannot be multiplied by crop rows.
       ============================================================ */

    LEFT JOIN (
      SELECT
        v.distno AS districtId,

        SUM(ld.land_area) AS totalArea

      FROM land_details ld

      JOIN mas_farmer f
        ON f.uf_id = ld.uf_id

      JOIN mas_villages v
        ON f.village_code = v.vsr_census

      GROUP BY
        v.distno

    ) land_totals
      ON land_totals.districtId = d.Rev_district_id

    /* ============================================================
       TOTAL DISTRICT PRODUCTION
       Crop details are intentionally used here.
       ============================================================ */

    LEFT JOIN (
      SELECT
        v.distno AS districtId,

        SUM(cd.crop_area * 19) AS totalProduction

      FROM crop_details cd

      JOIN land_details ld
        ON cd.id_masterkey_khasra = ld.id_masterkey_khasra

      JOIN mas_farmer f
        ON f.uf_id = ld.uf_id

      JOIN mas_villages v
        ON f.village_code = v.vsr_census

      GROUP BY
        v.distno

    ) production_totals
      ON production_totals.districtId = d.Rev_district_id

    /* ============================================================
       CROP-WISE DISTRICT DATA
       ============================================================ */

    LEFT JOIN (
      SELECT
        v.distno AS districtId,

        mc.crop_code AS cropCode,
        mc.crop_name AS cropName,

        COUNT(cd.crop_code) AS cropCount,

        SUM(cd.crop_area) AS cropArea,

        SUM(cd.crop_area * 19) AS cropProduction

      FROM crop_details cd

      JOIN land_details ld
        ON cd.id_masterkey_khasra = ld.id_masterkey_khasra

      JOIN mas_farmer f
        ON f.uf_id = ld.uf_id

      JOIN mas_villages v
        ON f.village_code = v.vsr_census

      JOIN mas_crop mc
        ON mc.crop_code = cd.crop_code

      GROUP BY
        v.distno,
        mc.crop_code,
        mc.crop_name

    ) c
      ON c.districtId = d.Rev_district_id

    ORDER BY
      districtName,
      cropName;
  `;

  try {
    const [rows] = await digitalAgriPool.query(query);

    const districtMap = new Map();

    for (const row of rows) {
      const districtId = Number(row.districtId);

      if (!districtMap.has(districtId)) {
        districtMap.set(
          districtId,
          new DistrictCropHeatmapDTO(
            districtId,
            row.districtName,
            0,
            Number(row.totalArea) || 0,
            Number(row.totalProduction) || 0,
            []
          )
        );
      }

      const district = districtMap.get(districtId);

      if (row.cropCode) {
        district.crops.push(
          new DistrictCropDTO(
            Number(row.cropCode),
            row.cropName,
            Number(row.cropCount) || 0,
            Number(row.cropArea) || 0,
            Number(row.cropProduction) || 0
          )
        );

        district.totalCropCount += Number(row.cropCount) || 0;
      }
    }

    return [...districtMap.values()];
  } catch (err) {
    console.error(
      "[ChartService:getCropCountHeatmap] Error:",
      err.message
    );

    throw new Error("Database query failed");
  }
}

async function getIotSummary() {
  const query = `
    SELECT
      (
        SELECT COUNT(DISTINCT f.uf_id)
        FROM iot_users iu
        JOIN mas_farmer f
          ON f.mobile_no = iu.mobileNo
      ) AS connectedFarmers,

      (
        SELECT COUNT(*)
        FROM iot_devices d
        WHERE d.deleted = 0
          AND d.status = 'online'
      ) AS activeDevices,

      (
        SELECT COUNT(DISTINCT v.distno)
        FROM iot_users iu
        JOIN mas_farmer f
          ON f.mobile_no = iu.mobileNo
        JOIN mas_villages v
          ON v.vsr_census = f.village_code
      ) AS districtsCovered,

      (
        SELECT COUNT(DISTINCT v.vsr_census)
        FROM iot_users iu
        JOIN mas_farmer f
          ON f.mobile_no = iu.mobileNo
        JOIN mas_villages v
          ON v.vsr_census = f.village_code
      ) AS villagesConnected,

      (
        SELECT CAST(
          COALESCE(SUM(ld.land_area), 0)
          AS DECIMAL(18,3)
        )
        FROM (
          SELECT DISTINCT
            f.uf_id
          FROM iot_users iu
          JOIN mas_farmer f
            ON f.mobile_no = iu.mobileNo
        ) connected_farmers
        JOIN land_details ld
          ON ld.uf_id = connected_farmers.uf_id
      ) AS totalArea;
  `;

  try {
    const [rows] = await digitalAgriPool.query(query);

    const [row = {}] = rows;

    return {
      connectedFarmers: Number(row.connectedFarmers) || 0,
      activeDevices: Number(row.activeDevices) || 0,
      districtsCovered: Number(row.districtsCovered) || 0,
      villagesConnected: Number(row.villagesConnected) || 0,
      totalArea: Number(row.totalArea) || 0
    };
  } catch (err) {
    console.error(
      "[ChartService:getIotSummary] Error:",
      err.message
    );

    throw new Error("Database query failed");
  }
}

export {
  getCropDistribution,
  getDistrictDistribution,
  getCropCountHeatmap,
};