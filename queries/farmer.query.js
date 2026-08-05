
export const FarmerQueries = {

    districtSummary({
        cropCode,
        districtId,
        farmerConditions,
        cropFilter,
        districtFilter,
        useMatchedJoin
    }) {
        return `
WITH filtered_farmers AS (
    SELECT DISTINCT
        f.uf_id,
        v.distno,
        fa.totalLand
    FROM mas_farmer f

    JOIN (
        SELECT
            uf_id,
            SUM(ld.land_area) AS totalLand
        FROM land_details ld
        GROUP BY uf_id
    ) fa
        ON f.uf_id = fa.uf_id

    JOIN mas_villages v
        ON f.village_code = v.vsr_census

    JOIN mas_tehsil t
        ON v.tehsilno = t.Rev_teh_id
       AND v.distno = t.Rev_dist_id

    WHERE 1=1
        ${farmerConditions}
        ${districtFilter}

    GROUP BY
        f.uf_id,
        v.distno,
        fa.totalLand
),
        
eligible_farmers AS (
    SELECT DISTINCT
        ff.uf_id,
        ff.distno,
        ff.totalLand
    FROM filtered_farmers ff

    JOIN land_details ld
        ON ff.uf_id = ld.uf_id

    JOIN crop_details cd
        ON cd.id_masterkey_khasra = ld.id_masterkey_khasra

    WHERE 1=1
        ${cropFilter}
)

SELECT
    d.Rev_district_id AS id,
    d.District_Name AS name,

    COALESCE(fcnt.totalFarmers,0) AS totalFarmers,

    COALESCE(overall_aggr.totalArea,0) AS totalArea,
    COALESCE(crop_aggr.cropArea,0) AS cropArea,

    COALESCE(overall_aggr.totalProduction,0) AS totalProduction,
    COALESCE(crop_aggr.cropProduction,0) AS cropProduction,

    COALESCE(overall_aggr.cropCount,0) AS cropCount

FROM mas_districts d

${useMatchedJoin
                ? `
JOIN (
    SELECT DISTINCT distno
    FROM eligible_farmers
) matched
    ON matched.distno = d.Rev_district_id
`
                : ""
            }

LEFT JOIN (
    SELECT
        ef.distno,
        COUNT(DISTINCT ef.uf_id) AS totalFarmers
    FROM eligible_farmers ef
    GROUP BY ef.distno
) fcnt
    ON fcnt.distno = d.Rev_district_id

/* ---------- OVERALL DISTRICT DATA ---------- */

LEFT JOIN (
    SELECT
        ff.distno AS district_id,

        CAST(SUM(ld.land_area) AS DECIMAL(18,3)) AS totalArea,

        CAST(SUM(cd.crop_area * 19) AS DECIMAL(18,3)) AS totalProduction,

        COUNT(DISTINCT cd.crop_code) AS cropCount

    FROM filtered_farmers ff

    JOIN land_details ld
        ON ff.uf_id = ld.uf_id

    JOIN crop_details cd
        ON cd.id_masterkey_khasra = ld.id_masterkey_khasra

    GROUP BY ff.distno

) overall_aggr
    ON overall_aggr.district_id = d.Rev_district_id

/* ---------- FILTERED CROP DATA ---------- */

LEFT JOIN (
    SELECT
        ef.distno AS district_id,

        CAST(SUM(cd.crop_area) AS DECIMAL(18,3)) AS cropArea,

        CAST(SUM(cd.crop_area * 19) AS DECIMAL(18,3)) AS cropProduction

    FROM eligible_farmers ef

    JOIN land_details ld
        ON ef.uf_id = ld.uf_id

    JOIN crop_details cd
        ON cd.id_masterkey_khasra = ld.id_masterkey_khasra

    ${cropCode
                ? "WHERE cd.crop_code = ?"
                : "WHERE 1 = 0"
            }

    GROUP BY ef.distno

) crop_aggr
    ON crop_aggr.district_id = d.Rev_district_id

${districtId ? "WHERE d.Rev_district_id = ?" : ""}

ORDER BY d.Rev_district_id;
        `;
    },

    tehsilSummary({
        cropCode,
        farmerConditions,
        cropFilter,
        useMatchedJoin
    }) {
        return `
    WITH filtered_farmers AS (
    SELECT DISTINCT
        f.uf_id,
        v.distno,
        t.Rev_teh_id AS tehsilId,
        fa.totalLand
    FROM mas_farmer f

    JOIN (
        SELECT
            uf_id,
            SUM(ld.land_area) totalLand
        FROM land_details ld
        GROUP BY uf_id
    ) fa
        ON fa.uf_id = f.uf_id

    JOIN mas_villages v
        ON f.village_code = v.vsr_census

    JOIN mas_tehsil t
        ON v.tehsilno = t.Rev_teh_id
       AND v.distno = t.Rev_dist_id

    WHERE 1=1
        ${farmerConditions}
        AND t.Rev_dist_id = ?

    GROUP BY
        f.uf_id,
        v.distno,
        t.Rev_teh_id,
        fa.totalLand
),
eligible_farmers AS (
    SELECT DISTINCT
        ff.uf_id,
        ff.distno,
        ff.tehsilId,
        ff.totalLand
    FROM filtered_farmers ff

    JOIN land_details ld
        ON ff.uf_id = ld.uf_id

    JOIN crop_details cd
        ON cd.id_masterkey_khasra = ld.id_masterkey_khasra

    WHERE 1=1
        ${cropFilter}
)
    SELECT
      t.Rev_teh_id AS id,
      t.Tehsil_Name AS name,

      COALESCE(fcnt.totalFarmers,0) AS totalFarmers,
      COALESCE(overall_aggr.totalArea,0) AS totalArea,
      COALESCE(crop_aggr.cropArea,0) AS cropArea,

      COALESCE(overall_aggr.totalProduction,0) AS totalProduction,
      COALESCE(crop_aggr.cropProduction,0) AS cropProduction,

      COALESCE(overall_aggr.cropCount,0) AS cropCount
    FROM mas_tehsil t

    ${useMatchedJoin
                ? `JOIN (
             SELECT DISTINCT ef.tehsilId
             FROM eligible_farmers ef
           ) matched
             ON matched.tehsilId = t.Rev_teh_id`
                : ""
            }

    LEFT JOIN (
      SELECT
        ef.tehsilId,
        COUNT(DISTINCT ef.uf_id) AS totalFarmers
      FROM eligible_farmers ef
      GROUP BY ef.tehsilId
    ) fcnt
      ON fcnt.tehsilId = t.Rev_teh_id

    LEFT JOIN (
    SELECT
        ff.tehsilId,

        CAST(SUM(ld.land_area) AS DECIMAL(18,3)) totalArea,

        CAST(SUM(cd.crop_area * 19) AS DECIMAL(18,3)) totalProduction,

        COUNT(DISTINCT cd.crop_code) cropCount

    FROM filtered_farmers ff

    JOIN land_details ld
        ON ff.uf_id = ld.uf_id

    JOIN crop_details cd
        ON cd.id_masterkey_khasra = ld.id_masterkey_khasra

    GROUP BY ff.tehsilId

) overall_aggr
    ON overall_aggr.tehsilId = t.Rev_teh_id
    LEFT JOIN (
    SELECT
        ef.tehsilId,

        CAST(SUM(cd.crop_area) AS DECIMAL(18,3)) cropArea,

        CAST(SUM(cd.crop_area * 19) AS DECIMAL(18,3)) cropProduction

    FROM eligible_farmers ef

    JOIN land_details ld
        ON ef.uf_id = ld.uf_id

    JOIN crop_details cd
        ON cd.id_masterkey_khasra = ld.id_masterkey_khasra

    ${cropCode ? "WHERE cd.crop_code = ?" : "WHERE 1 = 0"}

    GROUP BY ef.tehsilId

) crop_aggr
      ON crop_aggr.tehsilId = t.Rev_teh_id

    WHERE t.Rev_dist_id = ?

    ORDER BY t.Rev_teh_id;
  `;
    },

    villageSummary({
        cropCode,
        farmerConditions,
        cropFilter,
        useMatchedJoin
    }) {
        return `
  WITH filtered_farmers AS (
    SELECT DISTINCT
        f.uf_id,
        v.vsr_census AS villageId,
        fa.totalLand

    FROM mas_farmer f

    JOIN (
        SELECT
            uf_id,
            SUM(ld.land_area) AS totalLand
        FROM land_details ld
        GROUP BY uf_id
    ) fa
        ON fa.uf_id = f.uf_id

    JOIN mas_villages v
        ON f.village_code = v.vsr_census

    JOIN mas_tehsil t
        ON v.tehsilno = t.Rev_teh_id
       AND v.distno = t.Rev_dist_id

    WHERE 1=1
        ${farmerConditions}
        AND v.distno = ?
        AND v.tehsilno = ?

    GROUP BY
        f.uf_id,
        v.vsr_census,
        fa.totalLand
),

eligible_farmers AS (
    SELECT DISTINCT
        ff.uf_id,
        ff.villageId,
        ff.totalLand

    FROM filtered_farmers ff

    JOIN land_details ld
        ON ff.uf_id = ld.uf_id

    JOIN crop_details cd
        ON cd.id_masterkey_khasra = ld.id_masterkey_khasra

    WHERE 1=1
        ${cropFilter}
)

SELECT
    v.vsr_census AS id,
    v.villcdname AS name,

    COALESCE(fcnt.totalFarmers,0) AS totalFarmers,

    COALESCE(overall_aggr.totalArea,0) AS totalArea,
    COALESCE(crop_aggr.cropArea,0) AS cropArea,

    COALESCE(overall_aggr.totalProduction,0) AS totalProduction,
    COALESCE(crop_aggr.cropProduction,0) AS cropProduction,

    COALESCE(overall_aggr.cropCount,0) AS cropCount

FROM mas_villages v

${useMatchedJoin
                ? `
JOIN (
    SELECT DISTINCT villageId
    FROM eligible_farmers
) matched
    ON matched.villageId = v.vsr_census
`
                : ""}

LEFT JOIN (
    SELECT
        ef.villageId,
        COUNT(DISTINCT ef.uf_id) AS totalFarmers

    FROM eligible_farmers ef

    GROUP BY ef.villageId
) fcnt
    ON fcnt.villageId = v.vsr_census

/* ---------- OVERALL VILLAGE DATA ---------- */

LEFT JOIN (
    SELECT
        ff.villageId,

        CAST(SUM(ld.land_area) AS DECIMAL(18,3)) AS totalArea,

        CAST(SUM(cd.crop_area * 19) AS DECIMAL(18,3)) AS totalProduction,

        COUNT(DISTINCT cd.crop_code) AS cropCount

    FROM filtered_farmers ff

    JOIN land_details ld
        ON ff.uf_id = ld.uf_id

    JOIN crop_details cd
        ON cd.id_masterkey_khasra = ld.id_masterkey_khasra

    GROUP BY ff.villageId

) overall_aggr
    ON overall_aggr.villageId = v.vsr_census

/* ---------- FILTERED CROP DATA ---------- */

LEFT JOIN (
    SELECT
        ef.villageId,

        CAST(SUM(cd.crop_area) AS DECIMAL(18,3)) AS cropArea,

        CAST(SUM(cd.crop_area * 19) AS DECIMAL(18,3)) AS cropProduction

    FROM eligible_farmers ef

    JOIN land_details ld
        ON ef.uf_id = ld.uf_id

    JOIN crop_details cd
        ON cd.id_masterkey_khasra = ld.id_masterkey_khasra

    ${cropCode ? "WHERE cd.crop_code = ?" : "WHERE 1 = 0"}

    GROUP BY ef.villageId

) crop_aggr
    ON crop_aggr.villageId = v.vsr_census

WHERE
    v.distno = ?
    AND v.tehsilno = ?

ORDER BY
    v.villcdname;
  `;
    }

};