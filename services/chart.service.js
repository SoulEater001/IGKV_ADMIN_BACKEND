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

async function getDistrictDistribution() {
  const query = `
    SELECT
      d.Rev_district_id AS districtId,
      d.District_Name AS districtName,
      COUNT(DISTINCT f.uf_id) AS farmerCount
    FROM mas_farmer f
    JOIN mas_villages v
      ON f.village_code = v.vsr_census
    JOIN mas_districts d
      ON d.Rev_district_id = v.distno
    GROUP BY
      d.Rev_district_id,
      d.District_Name

    UNION ALL

    SELECT
      0 AS districtId,
      'Unknown' AS districtName,
      COUNT(DISTINCT f.uf_id) AS farmerCount
    FROM mas_farmer f
    LEFT JOIN mas_villages v
      ON f.village_code = v.vsr_census
    LEFT JOIN mas_districts d
      ON d.Rev_district_id = v.distno
    WHERE d.Rev_district_id IS NULL
    HAVING COUNT(DISTINCT f.uf_id) > 0

    ORDER BY farmerCount DESC;
  `;

  try {
    const [rows] = await digitalAgriPool.query(query);

    return rows.map(
      (row) =>
        new DistrictDistributionDTO(
          Number(row.districtId),
          row.districtName,
          Number(row.farmerCount) || 0
        )
    );
  } catch (err) {
    console.error("[ChartService:getDistrictDistribution] Error:", err.message);
    throw new Error("Database query failed");
  }
}

async function getCropCountHeatmap() {
  const query = `
  SELECT
    d.Rev_district_id AS districtId,
    d.District_Name_Eng AS districtName,

    COALESCE(dt.totalArea,0) AS totalArea,
    COALESCE(dt.totalProduction,0) AS totalProduction,

    c.cropCode,
    c.cropName,

    COALESCE(c.cropCount,0) AS cropCount,
    COALESCE(c.cropArea,0) AS cropArea,
    COALESCE(c.cropProduction,0) AS cropProduction

FROM mas_districts d

LEFT JOIN (

    SELECT
        v.distno AS districtId,

        SUM(ld.land_area) AS totalArea,

        SUM(cd.crop_area * 19) AS totalProduction

    FROM crop_details cd

    JOIN land_details ld
        ON cd.id_masterkey_khasra = ld.id_masterkey_khasra

    JOIN mas_farmer f
        ON f.uf_id = ld.uf_id

    JOIN mas_villages v
        ON f.village_code = v.vsr_census

    GROUP BY v.distno

) dt
ON dt.districtId = d.Rev_district_id


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
    `

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
    console.error("[ChartService:getCropCountHeatmap] Error:", err.message);
    throw new Error("Database query failed");
  }
}

export {
  getCropDistribution,
  getDistrictDistribution,
  getCropCountHeatmap,
};