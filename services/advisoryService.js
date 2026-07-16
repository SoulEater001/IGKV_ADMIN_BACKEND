export const executeCreateAdvisoryType = async (
    connection,
    data
) => {

    const [[existing]] = await connection.query(
        `
        SELECT id
        FROM imd_advisory_type
        WHERE imd_advisory_type_name = ?
        `,
        [data.imd_advisory_type_name]
    );

    if (existing) {
        throw new Error("Advisory type already exists.");
    }

    const [result] = await connection.query(
        `
        INSERT INTO imd_advisory_type
        (
            imd_advisory_type_name,
            imd_advisory_type_name_h
        )
        VALUES (?, ?)
        `,
        [
            data.imd_advisory_type_name,
            data.imd_advisory_type_name_h
        ]
    );

    await connection.query(
        `
        UPDATE imd_advisory_type
        SET imd_advisory_type_id = ?
        WHERE id = ?
        `,
        [
            result.insertId,
            result.insertId
        ]
    );

    return result.insertId;

};

export const executeDeleteAdvisoryType = async (
    connection,
    advisoryTypeId
) => {

    const [result] = await connection.query(
        `
        DELETE FROM imd_advisory_type
        WHERE id = ?
        `,
        [advisoryTypeId]
    );

    if (!result.affectedRows) {
        throw new Error("Advisory type not found.");
    }

    return advisoryTypeId;

};

export const executeUpdateAdvisoryType = async (
    connection,
    data
) => {

    const {
        id,
        imd_advisory_type_name,
        imd_advisory_type_name_h
    } = data;

    await connection.query(
        `
        UPDATE imd_advisory_type
        SET
            imd_advisory_type_name = ?,
            imd_advisory_type_name_h = ?
        WHERE id = ?
        `,
        [
            imd_advisory_type_name.trim(),
            imd_advisory_type_name_h?.trim() || null,
            id
        ]
    );

    return id;

};

export const executeCreateAdvisory = async (
    connection,
    data
) => {

    const [mainRows] = await connection.query(
        `
        SELECT id
        FROM imd_advisory_main
        WHERE DATE(advisory_date) = ?
        LIMIT 1
        `,
        [data.advisory_date]
    );

    let advisoryMainId;

    if (mainRows.length > 0) {

        advisoryMainId = mainRows[0].id;

    } else {

        const [result] = await connection.query(
            `
            INSERT INTO imd_advisory_main
            (
                advisory_date,
                create_datetime
            )
            VALUES (?, NOW())
            `,
            [data.advisory_date]
        );

        advisoryMainId = result.insertId;

        await connection.query(
            `
            UPDATE imd_advisory_main
            SET advisory_main_id = ?
            WHERE id = ?
            `,
            [
                advisoryMainId,
                advisoryMainId
            ]
        );

    }

    const [detailResult] = await connection.query(
        `
        INSERT INTO imd_advisory_detail
        (
            advisory_main_id,
            state_lg_code,
            district_lg_code,
            block_lg_code,
            cat_id,
            advisory_type_id,
            advisory,
            language_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
            advisoryMainId,
            data.state_lg_code,
            data.district_lg_code,
            data.block_lg_code,
            data.imd_category_id,
            data.imd_advisory_type_id,
            data.advisory,
            data.language_id
        ]
    );

    return detailResult.insertId;

};

export const executeDeleteAdvisory = async (
    connection,
    advisoryId
) => {

    const [[advisory]] = await connection.query(
        `
        SELECT
            id,
            advisory_main_id
        FROM imd_advisory_detail
        WHERE id = ?
        `,
        [advisoryId]
    );

    if (!advisory) {
        throw new Error("Advisory not found.");
    }

    await connection.query(
        `
        DELETE FROM imd_advisory_detail
        WHERE id = ?
        `,
        [advisoryId]
    );

    const [[remaining]] = await connection.query(
        `
        SELECT COUNT(*) AS total
        FROM imd_advisory_detail
        WHERE advisory_main_id = ?
        `,
        [advisory.advisory_main_id]
    );

    if (remaining.total === 0) {

        await connection.query(
            `
            DELETE FROM imd_advisory_main
            WHERE id = ?
            `,
            [advisory.advisory_main_id]
        );

    }

    return advisoryId;

};