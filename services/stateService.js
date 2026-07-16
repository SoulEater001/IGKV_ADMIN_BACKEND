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

export const executeUpdateState = async (
    connection,
    data,
    userId
) => {

    const {
        id,
        name_en,
        name_hi,
        state_lg_code
    } = data;

    const [[state]] = await connection.query(
        `
        SELECT state_lg_code
        FROM m_state
        WHERE state_id = ?
        `,
        [id]
    );

    const oldLgCode = state.state_lg_code;

    await connection.query(
        `
        UPDATE m_state
        SET
            name = ?,
            state_lg_code = ?,
            modify_by = ?
        WHERE state_id = ?
        `,
        [
            name_en.trim(),
            state_lg_code,
            userId,
            id
        ]
    );

    await connection.query(
        `
        UPDATE m_state_language
        SET
            name = ?,
            modify_by = ?
        WHERE
            state_id = ?
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
        UPDATE m_state_language
        SET
            name = ?,
            modify_by = ?
        WHERE
            state_id = ?
            AND language_id = 1
            AND deleted IS NULL
        `,
        [
            name_hi.trim(),
            userId,
            id
        ]
    );

    if (oldLgCode !== state_lg_code) {

        await connection.query(
            `
            UPDATE imd_advisory_main
            SET state_lg_code = ?
            WHERE state_lg_code = ?
            `,
            [
                state_lg_code,
                oldLgCode
            ]
        );

        await connection.query(
            `
            UPDATE imd_advisory_detail
            SET state_lg_code = ?
            WHERE state_lg_code = ?
            `,
            [
                state_lg_code,
                oldLgCode
            ]
        );

    }

    return id;

};