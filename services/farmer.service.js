import { digitalAgriPool } from "../config/digitalAgriDb.js";
import {
  FarmerTableDTO,
  FarmerSummaryResponse,
  FarmerBasicDTO,
  FarmerBasicSummaryResponse,
  FarmerPersonalDTO,
  FarmerLandDTO,
  FarmerCropDTO,
} from '../models/farmer.dto.js';
import { FarmerQueries } from "../queries/farmer.query.js";


async function getDistrictSummary(cropCode, farmerType, districtId) {
  // console.log("District summary service hit");

  let farmerConditions = "";
  const params = [];

  if (farmerType) {
    if (farmerType === "MARGINAL") {
      farmerConditions += " AND fa.totalLand < 1 ";
    } else if (farmerType === "SMALL") {
      farmerConditions += " AND fa.totalLand >= 1 AND fa.totalLand < 2 ";
    } else if (farmerType === "SEMI_MEDIUM") {
      farmerConditions += " AND fa.totalLand >= 2 AND fa.totalLand < 4 ";
    } else if (farmerType === "MEDIUM") {
      farmerConditions += " AND fa.totalLand >= 4 AND fa.totalLand <= 10 ";
    } else if (farmerType === "LARGE") {
      farmerConditions += " AND fa.totalLand > 10 ";
    }
  }

  const cropFilter = cropCode ? " AND cd.crop_code = ? " : "";
  const districtFilter = districtId ? " AND v.distno = ? " : "";
  const useMatchedJoin = cropCode || farmerType || districtId;

  const query = FarmerQueries.districtSummary({
    cropCode,
    districtId,
    farmerConditions,
    cropFilter,
    districtFilter,
    useMatchedJoin,
  });

  if (districtId) {
    params.push(Number(districtId));
  }

  if (cropCode) {
    params.push(Number(cropCode));
  }

  if (cropCode) {
    params.push(Number(cropCode));
  }

  if (districtId) {
    params.push(Number(districtId));
  }

  try {
    // console.log("try block")
    const [rows] = await digitalAgriPool.query(query, params);

    const items = rows.map(
      (row) =>
        new FarmerTableDTO(
          Number(row.id),
          row.name,

          Number(row.totalFarmers) || 0,

          // Overall values
          Number(row.totalArea) || 0,
          Number(row.cropArea) || 0,

          Number(row.totalProduction) || 0,
          Number(row.cropProduction) || 0,

          Number(row.cropCount) || 0
        )
    );

    const totalFarmers = items.reduce(
      (sum, r) => sum + r.totalFarmers,
      0
    );

    const totalArea = items.reduce(
      (sum, r) => sum + r.totalArea,
      0
    );

    const totalProduction = items.reduce(
      (sum, r) => sum + r.totalProduction,
      0
    );

    return new FarmerSummaryResponse(
      items,
      totalFarmers,
      totalArea,
      totalProduction
    );
  } catch (err) {
    console.error("[FarmerService:getDistrictSummary]", err);
    throw new Error("Database query failed");
  }
}

async function getTehsilSummary(cropCode, farmerType, districtId) {
  let farmerConditions = "";
  const params = [];

  if (farmerType) {
    if (farmerType === "MARGINAL") {
      farmerConditions += " AND fa.totalLand < 1 ";
    } else if (farmerType === "SMALL") {
      farmerConditions += " AND fa.totalLand >= 1 AND fa.totalLand < 2 ";
    } else if (farmerType === "SEMI_MEDIUM") {
      farmerConditions += " AND fa.totalLand >= 2 AND fa.totalLand < 4 ";
    } else if (farmerType === "MEDIUM") {
      farmerConditions += " AND fa.totalLand >= 4 AND fa.totalLand <= 10 ";
    } else if (farmerType === "LARGE") {
      farmerConditions += " AND fa.totalLand > 10 ";
    }
  }

  const cropFilter = cropCode ? " AND cd.crop_code = ? " : "";
  const useMatchedJoin = cropCode || farmerType || districtId;

  const query = FarmerQueries.tehsilSummary({
    cropCode,
    farmerConditions,
    cropFilter,
    useMatchedJoin,
  });

  params.push(Number(districtId));

  if (cropCode) {
    params.push(Number(cropCode));
  }
  if (cropCode) {
    params.push(Number(cropCode));
  }

  params.push(Number(districtId));

  try {
    const [rows] = await digitalAgriPool.query(query, params);

    const items = rows.map(
      (row) =>
        new FarmerTableDTO(
          Number(row.id),
          row.name,

          Number(row.totalFarmers) || 0,

          Number(row.totalArea) || 0,
          Number(row.cropArea) || 0,

          Number(row.totalProduction) || 0,
          Number(row.cropProduction) || 0,

          Number(row.cropCount) || 0
        )
    );

    const totalFarmers = items.reduce(
      (sum, r) => sum + r.totalFarmers,
      0
    );

    const totalArea = items.reduce(
      (sum, r) => sum + r.totalArea,
      0
    );

    const totalProduction = items.reduce(
      (sum, r) => sum + r.totalProduction,
      0
    );

    return new FarmerSummaryResponse(
      items,
      totalFarmers,
      totalArea,
      totalProduction
    );
  } catch (err) {
    console.error("[FarmerService:getTehsilSummary]", err);
    throw new Error("Database query failed");
  }
}

async function getVillageSummary(cropCode, farmerType, districtId, tehsilNo) {
  let farmerConditions = "";
  const params = [];

  if (farmerType) {
    if (farmerType === "MARGINAL") {
      farmerConditions += " AND fa.totalLand < 1 ";
    } else if (farmerType === "SMALL") {
      farmerConditions += " AND fa.totalLand >= 1 AND fa.totalLand < 2 ";
    } else if (farmerType === "SEMI_MEDIUM") {
      farmerConditions += " AND fa.totalLand >= 2 AND fa.totalLand < 4 ";
    } else if (farmerType === "MEDIUM") {
      farmerConditions += " AND fa.totalLand >= 4 AND fa.totalLand <= 10 ";
    } else if (farmerType === "LARGE") {
      farmerConditions += " AND fa.totalLand > 10 ";
    }
  }

  const cropFilter = cropCode ? " AND cd.crop_code = ? " : "";
  const useMatchedJoin = cropCode || farmerType || districtId || tehsilNo;

  const query = FarmerQueries.villageSummary({
    cropCode,
    farmerConditions,
    cropFilter,
    useMatchedJoin,
  });

  params.push(Number(districtId), Number(tehsilNo));

  if (cropCode) {
    params.push(Number(cropCode));  //eligible_farmers
  }

  if (cropCode) {
    params.push(Number(cropCode)); // crop_aggr
  }

  params.push(Number(districtId), Number(tehsilNo));

  try {
    const [rows] = await digitalAgriPool.query(query, params);

    const items = rows.map(
      row =>
        new FarmerTableDTO(
          Number(row.id),
          row.name,

          Number(row.totalFarmers) || 0,

          Number(row.totalArea) || 0,
          Number(row.cropArea) || 0,

          Number(row.totalProduction) || 0,
          Number(row.cropProduction) || 0,

          Number(row.cropCount) || 0
        )
    );

    const totalFarmers = items.reduce(
      (sum, r) => sum + r.totalFarmers,
      0
    );

    const totalArea = items.reduce(
      (sum, r) => sum + r.totalArea,
      0
    );

    const totalProduction = items.reduce(
      (sum, r) => sum + r.totalProduction,
      0
    );

    return new FarmerSummaryResponse(
      items,
      totalFarmers,
      totalArea,
      totalProduction
    );
  } catch (err) {
    console.error("[FarmerService:getVillageSummary]", err);
    throw new Error("Database query failed");
  }
}

async function getFarmerBasicList(districtId, tehsilNo, villageId, cropCode) {
  const params = [];
  let where = " WHERE 1=1 ";

  if (districtId) {
    where += " AND v.distno = ? ";
    params.push(Number(districtId));
  }

  if (tehsilNo) {
    where += " AND v.tehsilno = ? ";
    params.push(Number(tehsilNo));
  }

  if (villageId) {
    where += " AND v.vsr_census = ? ";
    params.push(Number(villageId));
  }

  if (cropCode) {
    where += " AND cd.crop_code = ? ";
    params.push(Number(cropCode));
  }

  const query = `
    SELECT
      f.uf_id AS farmerId,
      f.farmer_name_hi AS farmerName,
      f.mobile_no AS mobileNo,
      v.villcdname AS villageName,
      SUM(ld.land_area) AS totalArea,
      SUM(cd.crop_area * 19) AS totalProduction
    FROM mas_farmer f
    JOIN mas_villages v
      ON f.village_code = v.vsr_census
    LEFT JOIN land_details ld
      ON f.uf_id = ld.uf_id
    LEFT JOIN crop_details cd
      ON cd.id_masterkey_khasra = ld.id_masterkey_khasra
    ${where}
    GROUP BY
      f.uf_id,
      f.farmer_name_hi,
      f.mobile_no,
      v.villcdname
    ORDER BY f.farmer_name_hi;
  `;

  try {
    const [rows] = await digitalAgriPool.query(query, params);

    const items = rows.map(
      (row) =>
        new FarmerBasicDTO(
          Number(row.farmerId),
          row.farmerName,
          row.mobileNo,
          row.villageName
        )
    );

    const totalFarmers = items.length;

    const totalArea = rows.reduce(
      (sum, row) => sum + (Number(row.totalArea) || 0),
      0
    );

    const totalProduction = rows.reduce(
      (sum, row) => sum + (Number(row.totalProduction) || 0),
      0
    );

    return new FarmerBasicSummaryResponse(
      items,
      totalFarmers,
      totalArea,
      totalProduction
    );
  } catch (err) {
    console.error("[FarmerService:getFarmerBasicList]", err);
    throw new Error("Database query failed");
  }
}

async function getHomeSummary() {
  const query = `
    SELECT
      (
        SELECT COUNT(DISTINCT f.uf_id)
        FROM mas_farmer f
      ) AS totalFarmers,

      (
        SELECT CAST(
          SUM(ld.land_area)
          AS DECIMAL(18,3)
        )
        FROM land_details ld
      ) AS totalArea,

      (
        SELECT CAST(
          SUM(cd.crop_area * 19)
          AS DECIMAL(18,3)
        )
        FROM crop_details cd
      ) AS totalProduction,

      (
        SELECT COUNT(DISTINCT cd.crop_code)
        FROM crop_details cd
      ) AS cropCount;
  `;

  try {
    const [rows] = await digitalAgriPool.query(query);

    const [row = {}] = rows;

    return {
      totalFarmers: Number(row.totalFarmers) || 0,
      totalArea: Number(row.totalArea) || 0,
      totalProduction: Number(row.totalProduction) || 0,
      cropCount: Number(row.cropCount) || 0,
    };
  } catch (err) {
    console.error("[FarmerService:getHomeSummary]", err);
    throw new Error("Database query failed");
  }
}

async function getFarmerProfileDetails(ufId) {
  try {
    const personalQuery = `
      SELECT 
        f.uf_id AS farmerId,
        f.farmer_name_aadhar AS farmerName,
        f.father_name AS fatherName,
        f.aadhar_number AS aadharNumber,
        f.dob AS dob,
        f.gender AS gender,
        f.mobile_no AS mobileNo,
        v.villcdname AS village,
        t.Tehsil_Name AS tehsil,
        d.District_Name AS district
      FROM mas_farmer f
      LEFT JOIN mas_villages v
        ON f.village_code = v.vsr_census
      LEFT JOIN mas_tehsil t
        ON v.tehsilno = t.Rev_teh_id
       AND v.distno = t.Rev_dist_id
      LEFT JOIN mas_districts d
        ON v.distno = d.Rev_district_id
      WHERE f.uf_id = ?;
    `;

    const [rows] = await digitalAgriPool.query(personalQuery, [ufId]);

    if (!rows.length) {
      return null;
    }

    const p = rows[0];

    const dob = p.dob
      ? new Date(p.dob).toISOString().split("T")[0]
      : null;

    let age = null;

    if (p.dob) {
      const birthDate = new Date(p.dob);
      const diff = Date.now() - birthDate.getTime();
      age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    }

    return new FarmerPersonalDTO(
      p.farmerId,
      p.farmerName,
      p.fatherName,
      p.aadharNumber,
      dob,
      age,
      p.gender,
      p.mobileNo,
      p.district,
      p.tehsil,
      p.village
    );
  } catch (err) {
    console.error(
      "[FarmerService:getFarmerProfileDetails]",
      err
    );
    throw new Error("Database query failed");
  }
}

async function getFarmerLandDetails(ufId) {
  const query = `
    SELECT 
      ld.khasra_no AS khasraNo,
      ld.basra_no AS basraNo,
      ld.land_area AS landArea,
      ld.OwnerName AS ownerName,
      ld.patwari_halka AS patwariHalkaNo,
      ld.sinchit_asinchit AS irrigationCode,
      v.villcdname AS village
    FROM land_details ld
    LEFT JOIN mas_villages v
      ON v.vsr_census = ld.village_code
    WHERE ld.uf_id = ?;
  `;

  try {
    const [rows] = await digitalAgriPool.query(query, [ufId]);

    return rows.map(
      (row) =>
        new FarmerLandDTO(
          row.khasraNo,
          row.basraNo,
          Number(row.landArea) || 0,
          row.ownerName || null,
          row.patwariHalkaNo || null,
          row.irrigationCode === 1 ? "Sinchit" : "Asinchit",
          row.village || null
        )
    );
  } catch (err) {
    console.error("[FarmerService:getFarmerLandDetails]", err);
    throw new Error("Database query failed");
  }
}

async function getFarmerCropDetails(ufId) {
  const query = `
    SELECT 
      ld.khasra_no AS khasraNo,
      cd.crop_code AS cropCode,
      mc.crop_name AS cropName,
      cd.crop_area AS cropArea
    FROM crop_details cd
    JOIN land_details ld
      ON cd.id_masterkey_khasra = ld.id_masterkey_khasra
    LEFT JOIN mas_crop mc
      ON cd.crop_code = mc.crop_code
    WHERE ld.uf_id = ?
    ORDER BY ld.khasra_no, cd.crop_code;
  `;

  try {
    const [rows] = await digitalAgriPool.query(query, [ufId]);

    return rows.map(
      (row) =>
        new FarmerCropDTO(
          row.cropCode,
          row.cropName,
          row.khasraNo,
          Number(row.cropArea) || 0
        )
    );
  } catch (err) {
    console.error("[FarmerService:getFarmerCropDetails]", err);
    throw new Error("Database query failed");
  }
}

export {
  getDistrictSummary,
  getTehsilSummary,
  getVillageSummary,
  getFarmerBasicList,
  getHomeSummary,
  getFarmerProfileDetails,
  getFarmerLandDetails,
  getFarmerCropDetails,
};
