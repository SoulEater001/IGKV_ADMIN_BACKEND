export const executeCreateBlock = async (
    connection,
    blockData,
    userId
) => {

    const {
        name_en,
        name_hi,
        district_id,
        block_lg_code,
        latitude,
        longitude
    } = blockData;

    const [[existing]] = await connection.query(
        `
        SELECT block_id
        FROM m_block
        WHERE
            (
                LOWER(name) = LOWER(?)
                OR block_lg_code = ?
            )
            AND deleted IS NULL
        `,
        [
            name_en.trim(),
            block_lg_code
        ]
    );
    console.log(existing)

    if (existing) {
        throw new Error("Block already exists.");
    }

    const [result] = await connection.query(
        `
        INSERT INTO m_block
        (
            name,
            district_id,
            block_lg_code,
            latitude,
            longitude,
            create_by
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
            name_en.trim(),
            district_id,
            block_lg_code,
            latitude,
            longitude,
            userId
        ]
    );

    const blockId = result.insertId;

    await connection.query(
        `
        INSERT INTO m_block_language
        (
            block_id,
            language_id,
            name,
            create_by
        )
        VALUES
            (?, 2, ?, ?),
            (?, 1, ?, ?)
        `,
        [
            blockId,
            name_en.trim(),
            userId,

            blockId,
            name_hi.trim(),
            userId
        ]
    );

    return blockId;
};

export const executeDeleteBlock = async (
    connection,
    blockId,
    userId
) => {

    await connection.query(
        `
        UPDATE m_block
        SET
            deleted = 'Y',
            delete_by = ?,
            delete_datetime = NOW()
        WHERE
            block_id = ?
            AND deleted IS NULL
        `,
        [
            userId,
            blockId
        ]
    );

    await connection.query(
        `
        UPDATE m_block_language
        SET
            deleted = 'Y',
            delete_by = ?,
            delete_datetime = NOW()
        WHERE
            block_id = ?
            AND deleted IS NULL
        `,
        [
            userId,
            blockId
        ]
    );
    return blockId;

};