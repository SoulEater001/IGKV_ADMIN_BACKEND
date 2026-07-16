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

export const executeUpdateZone = async (
    connection,
    data,
    userId
) => {

    const {
        id,
        name_en,
        name_hi,
        state_id,
        imagePath = null
    } = data;

    await connection.query(
        `
        UPDATE m_zone
        SET
            name = ?,
            state_id = ?,
            Image_Path = ?,
            modify_by = ?
        WHERE Zone_id = ?
        `,
        [
            name_en.trim(),
            state_id,
            imagePath,
            userId,
            id
        ]
    );

    await connection.query(
        `
        UPDATE m_zone_language
        SET
            name = ?,
            state_id = ?,
            modify_by = ?
        WHERE
            zone_id = ?
            AND language_id = 2
            AND deleted IS NULL
        `,
        [
            name_en.trim(),
            state_id,
            userId,
            id
        ]
    );

    await connection.query(
        `
        UPDATE m_zone_language
        SET
            name = ?,
            state_id = ?,
            modify_by = ?
        WHERE
            zone_id = ?
            AND language_id = 1
            AND deleted IS NULL
        `,
        [
            name_hi.trim(),
            state_id,
            userId,
            id
        ]
    );

    return id;

};