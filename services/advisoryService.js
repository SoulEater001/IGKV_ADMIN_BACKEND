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
            crop_id,
            advisory_type_id,
            advisory,
            language_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
            advisoryMainId,
            data.state_lg_code,
            data.district_lg_code,
            data.block_lg_code,
            data.imd_category_id,
            data.crop_id,
            data.imd_advisory_type_id,
            data.advisory,
            data.language_id
        ]
    );

    return detailResult.insertId;

};

export const executeCreateBulkAdvisories = async (
    connection,
    advisories
) => {
    const advisoriesByDate = new Map();

    for (const advisory of advisories) {

        if (!advisoriesByDate.has(advisory.advisory_date)) {

            advisoriesByDate.set(
                advisory.advisory_date,
                []
            );

        }

        advisoriesByDate
            .get(advisory.advisory_date)
            .push(advisory);

    }

    const advisoryMainIdByDate = new Map();

    for (const [advisoryDate] of advisoriesByDate) {

        const [mainRows] = await connection.query(
            `
        SELECT id
        FROM imd_advisory_main
        WHERE DATE(advisory_date) = ?
        LIMIT 1
        `,
            [advisoryDate]
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
                [advisoryDate]
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

        advisoryMainIdByDate.set(
            advisoryDate,
            advisoryMainId
        );

    }

    // return {
    //     groupedDates: advisoriesByDate,
    //     advisoryMainIdByDate
    // };

    // let detailsInserted = 0;
    let advisoriesCreated = 0;
    let languageRowsInserted = 0;

    for (const [advisoryDate, entries] of advisoriesByDate) {

        const advisoryMainId =
            advisoryMainIdByDate.get(advisoryDate);


        for (const advisory of entries) {


            // =====================================================
            // ENGLISH
            // =====================================================

            const [englishResult] = await connection.query(
                `
                INSERT INTO imd_advisory_detail
                (
                    advisory_main_id,
                    advisory_detail_id,

                    state_lg_code,
                    district_lg_code,
                    block_lg_code,

                    cat_id,
                    crop_id,
                    advisory_type_id,

                    advisory,
                    language_id
                )
                VALUES (
                    ?, ?,
                    ?, ?, ?,
                    ?, ?, ?,
                    ?, ?
                )
                `,
                [
                    advisoryMainId,

                    // temporary value
                    null,

                    advisory.state_lg_code,
                    advisory.district_lg_code,
                    advisory.block_lg_code,

                    advisory.imd_category_id,
                    advisory.crop_id,
                    advisory.imd_advisory_type_id,

                    advisory.advisory_en,
                    2
                ]
            );


            const advisoryDetailId =
                englishResult.insertId;


            // =====================================================
            // Set logical advisory ID on English row
            // =====================================================

            await connection.query(
                `
                UPDATE imd_advisory_detail
                SET advisory_detail_id = ?
                WHERE id = ?
                `,
                [
                    advisoryDetailId,
                    advisoryDetailId
                ]
            );


            // =====================================================
            // HINDI
            // =====================================================

            await connection.query(
                `
                INSERT INTO imd_advisory_detail
                (
                    advisory_main_id,
                    advisory_detail_id,

                    state_lg_code,
                    district_lg_code,
                    block_lg_code,

                    cat_id,
                    crop_id,
                    advisory_type_id,

                    advisory,
                    language_id
                )
                VALUES (
                    ?, ?,
                    ?, ?, ?,
                    ?, ?, ?,
                    ?, ?
                )
                `,
                [
                    advisoryMainId,

                    // Same logical ID
                    advisoryDetailId,

                    advisory.state_lg_code,
                    advisory.district_lg_code,
                    advisory.block_lg_code,

                    advisory.imd_category_id,
                    advisory.crop_id,
                    advisory.imd_advisory_type_id,

                    advisory.advisory_hi,
                    1
                ]
            );


            languageRowsInserted += 2;
            advisoriesCreated++;

        }

    }

    return {
        totalReceived: advisories.length,

        groupedDates: [...advisoriesByDate.entries()].map(
            ([date, entries]) => ({
                advisory_date: date,
                advisories: entries.length
            })
        ),
        sample: advisories.slice(0, 3),
        mainRowsCreated: advisoryMainIdByDate.size,

        advisoriesCreated,
        languageRowsInserted
    };
}

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

export const executeUpdateAdvisory = async (
    connection,
    data
) => {

    const {
        id,
        state_lg_code,
        district_lg_code,
        block_lg_code,
        imd_category_id,
        crop_id,
        imd_advisory_type_id,
        advisory,
        language_id
    } = data;

    await connection.query(
        `
        UPDATE imd_advisory_detail
        SET
            state_lg_code = ?,
            district_lg_code = ?,
            block_lg_code = ?,
            cat_id = ?,
            crop_id = ?,
            advisory_type_id = ?,
            advisory = ?,
            language_id = ?
        WHERE id = ?
        `,
        [
            state_lg_code,
            district_lg_code,
            block_lg_code,
            imd_category_id,
            crop_id,
            imd_advisory_type_id,
            advisory.trim(),
            language_id,
            id
        ]
    );

    return id;

};