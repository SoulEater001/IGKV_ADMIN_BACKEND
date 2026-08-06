import { digitalAgriPool } from "../config/digitalAgriDb.js";
import {
  DistrictDTO,
  TehsilDTO,
  VillageDTO,
  CropDTO,
  DistrictOnlyDTO,
} from "../models/filter.dto.js";

async function getLocationHierarchy() {
  const query = `
    SELECT 
      d.Rev_district_id AS districtId,
      d.District_Name AS districtName,
      t.Rev_teh_id AS tehsilId,
      t.Tehsil_Name AS tehsilName,
      v.vsr_census AS villageId,
      v.villcdname AS villageName
    FROM mas_districts d
    JOIN mas_tehsil t
      ON d.Rev_district_id = t.Rev_dist_id
    JOIN mas_villages v
      ON v.tehsilno = t.Rev_teh_id
     AND v.distno = d.Rev_district_id
    ORDER BY d.District_Name, t.Tehsil_Name, v.villcdname;
  `;

  try {
    const [rows] = await digitalAgriPool.query(query);

    const districtMap = new Map();

    rows.forEach((row) => {
      if (!districtMap.has(row.districtId)) {
        districtMap.set(
          row.districtId,
          new DistrictDTO(row.districtId, row.districtName, [])
        );
      }

      const district = districtMap.get(row.districtId);

      let tehsil = district.tehsils.find(
        (t) => t.tehsilId === row.tehsilId
      );

      if (!tehsil) {
        tehsil = new TehsilDTO(row.tehsilId, row.tehsilName, []);
        district.tehsils.push(tehsil);
      }

      tehsil.villages.push(
        new VillageDTO(row.villageId, row.villageName)
      );
    });

    return Array.from(districtMap.values());
  } catch (err) {
    console.error("[FilterService:getLocationHierarchy]", err);
    throw new Error("Database query failed");
  }
}

async function getCropList() {
  const query = `
    SELECT
      crop_code AS cropCode,
      crop_name AS cropName
    FROM mas_crop
    ORDER BY crop_name;
  `;

  try {
    const [rows] = await digitalAgriPool.query(query);

    return rows.map(
      (row) => new CropDTO(Number(row.cropCode), row.cropName)
    );
  } catch (err) {
    console.error("[FilterService:getCropList]", err);
    throw new Error("Database query failed");
  }
}

async function getAllDistricts() {
  const query = `
    SELECT
      Rev_district_id AS districtId,
      District_Name AS districtName
    FROM mas_districts
    ORDER BY District_Name;
  `;

  try {
    const [rows] = await digitalAgriPool.query(query);

    return rows.map(
      (row) =>
        new DistrictOnlyDTO(
          Number(row.districtId),
          row.districtName
        )
    );
  } catch (err) {
    console.error("[FilterService:getAllDistricts]", err);
    throw new Error("Database query failed");
  }
}

export {
  getLocationHierarchy,
  getCropList,
  getAllDistricts,
};