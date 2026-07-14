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