export const executeCreateDistrict = async (
    connection,
    data,
    userId
) => {

    const {
        name_en,
        name_hi,
        state_id,
        zone_id,
        district_lg_code
    } = data;

    const [[existing]] = await connection.query(
        `
        SELECT district_id
        FROM m_district
        WHERE
            (
                LOWER(name) = LOWER(?)
                OR district_lg_code = ?
            )
            AND deleted IS NULL
        `,
        [
            name_en.trim(),
            district_lg_code
        ]
    );

    if (existing) {
        throw new Error("District already exists.");
    }

    const [result] = await connection.query(
        `
        INSERT INTO m_district
        (
            name,
            state_id,
            zone_id,
            district_lg_code,
            create_by
        )
        VALUES (?, ?, ?, ?, ?)
        `,
        [
            name_en.trim(),
            state_id,
            zone_id,
            district_lg_code,
            userId
        ]
    );

    const districtId = result.insertId;

    await connection.query(
        `
        INSERT INTO m_district_language
        (
            district_id,
            state_id,
            language_id,
            name,
            create_by
        )
        VALUES
            (?, ?, 2, ?, ?),
            (?, ?, 1, ?, ?)
        `,
        [
            districtId,
            state_id,
            name_en.trim(),
            userId,

            districtId,
            state_id,
            name_hi.trim(),
            userId
        ]
    );

    return districtId;

};

export const executeDeleteDistrict = async (
    connection,
    districtId,
    userId
) => {
    await connection.query(
        `
        UPDATE m_district
        SET
            deleted = 'Y',
            delete_datetime = NOW(),
            delete_by = ?
        WHERE
            district_id = ?
            AND deleted IS NULL
        `,
        [
            userId,
            districtId
        ]
    );

    await connection.query(
        `
        UPDATE m_district_language
        SET
            deleted = 'Y',
            delete_datetime = NOW(),
            delete_by = ?
        WHERE
            district_id = ?
            AND deleted IS NULL
        `,
        [
            userId,
            districtId
        ]
    );
    return districtId;

};