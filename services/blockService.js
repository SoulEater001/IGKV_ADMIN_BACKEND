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

export const executeUpdateBlock = async (
    connection,
    data,
    userId
) => {

    const {
        id,
        name_en,
        name_hi,
        district_id,
        block_lg_code,
        latitude = null,
        longitude = null
    } = data;

    const [[block]] = await connection.query(
        `
        SELECT block_lg_code
        FROM m_block
        WHERE block_id = ?
        `,
        [id]
    );

    const oldLgCode = block.block_lg_code;

    if (oldLgCode !== block_lg_code) {

        await connection.query(
            `
            UPDATE imd_advisory_main
            SET block_lg_code = ?
            WHERE block_lg_code = ?
            `,
            [
                block_lg_code,
                oldLgCode
            ]
        );

        await connection.query(
            `
            UPDATE imd_advisory_detail
            SET block_lg_code = ?
            WHERE block_lg_code = ?
            `,
            [
                block_lg_code,
                oldLgCode
            ]
        );

    }

    await connection.query(
        `
        UPDATE m_block
        SET
            name = ?,
            district_id = ?,
            block_lg_code = ?,
            latitude = ?,
            longitude = ?,
            modify_by = ?,
            modify_datetime = NOW()
        WHERE block_id = ?
        `,
        [
            name_en.trim(),
            district_id,
            block_lg_code,
            latitude,
            longitude,
            userId,
            id
        ]
    );

    await connection.query(
        `
        UPDATE m_block_language
        SET
            name = ?,
            modify_by = ?,
            modify_datetime = NOW()
        WHERE
            block_id = ?
            AND language_id = 2
            AND deleted IS NULL
        `,
        [
            name_en.trim(),
            userId,
            id
        ]
    );

    await connection.query(
        `
        UPDATE m_block_language
        SET
            name = ?,
            modify_by = ?,
            modify_datetime = NOW()
        WHERE
            block_id = ?
            AND language_id = 1
            AND deleted IS NULL
        `,
        [
            name_hi.trim(),
            userId,
            id
        ]
    );

    return id;

};