export const executeCreateZone = async (
    connection,
    zoneData,
    userId
) => {

    const [result] = await connection.query(
        `
        INSERT INTO m_zone
        (
            name,
            state_id,
            Image_Path,
            create_by
        )
        VALUES (?, ?, ?, ?)
        `,
        [
            zoneData.name_en,
            zoneData.state_id,
            zoneData.imagePath,
            userId
        ]
    );

    const zoneId = result.insertId;

    await connection.query(
        `
        INSERT INTO m_zone_language
        (
            zone_id,
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
            zoneId,
            zoneData.state_id,
            zoneData.name_en,
            userId,

            zoneId,
            zoneData.state_id,
            zoneData.name_hi,
            userId
        ]
    );

    return zoneId;

};

export const executeDeleteZone = async (
    connection,
    zoneId,
    userId
) => {

    await connection.query(
        `
        UPDATE m_zone
        SET
            deleted = 'Y',
            delete_datetime = NOW(),
            delete_by = ?
        WHERE
            Zone_id = ?
            AND deleted IS NULL
        `,
        [
            userId,
            zoneId
        ]
    );

    await connection.query(
        `
        UPDATE m_zone_language
        SET
            deleted = 'Y',
            delete_datetime = NOW(),
            delete_by = ?
        WHERE
            zone_id = ?
            AND deleted IS NULL
        `,
        [
            userId,
            zoneId
        ]
    );

};