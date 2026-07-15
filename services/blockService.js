export const executeCreateBlock = async (
    connection,
    blockData,
    userId
) => {

    const [[existing]] = await connection.query(
        `
        SELECT block_id
        FROM m_block
        WHERE
            (
                LOWER(name) = LOWER(?)
                OR block_lg_code = ?
            )
            AND (deleted IS NULL OR deleted = 'N')
        `,
        [
            blockData.name,
            blockData.block_lg_code
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
            blockData.name,
            blockData.district_id,
            blockData.block_lg_code,
            blockData.latitude,
            blockData.longitude,
            userId
        ]
    );

    return result.insertId;

};