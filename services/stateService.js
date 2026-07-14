export const executeCreateState = async (
    connection,
    stateData,
    userId
) => {

    const [result] = await connection.query(
        `
        INSERT INTO m_state
        (
            name,
            state_lg_code,
            create_by
        )
        VALUES (?, ?, ?)
        `,
        [
            stateData.name_en,
            stateData.state_lg_code,
            userId
        ]
    );

    const stateId = result.insertId;

    await connection.query(
        `
        INSERT INTO m_state_language
        (
            state_id,
            language_id,
            name,
            create_by
        )
        VALUES
            (?, 2, ?, ?),
            (?, 1, ?, ?)
        `,
        [
            stateId,
            stateData.name_en,
            userId,

            stateId,
            stateData.name_hi,
            userId
        ]
    );

    return stateId;

};

export const executeDeleteState = async (
    connection,
    stateId,
    userId
) => {

    await connection.query(
        `
        UPDATE m_state
        SET
            deleted = 'Y',
            delete_datetime = NOW(),
            delete_by = ?
        WHERE
            state_id = ?
            AND deleted IS NULL
        `,
        [
            userId,
            stateId
        ]
    );

    await connection.query(
        `
        UPDATE m_state_language
        SET
            deleted = 'Y',
            delete_datetime = NOW(),
            delete_by = ?
        WHERE
            state_id = ?
            AND deleted IS NULL
        `,
        [
            userId,
            stateId
        ]
    );

    return stateId;

};