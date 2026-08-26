export const executeCreateCropRange = async (
    connection,
    data
) => {

    const [result] = await connection.query(
        `
        INSERT INTO crop_ranges
        (
            crop_id,
            crop_stage_id,
            start_date,
            end_date,
            description,
            is_active
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
            data.crop_id,
            data.crop_stage_id,
            data.start_date,
            data.end_date,
            data.description ?? null,
            data.is_active ? 1 : 0
        ]
    );

    return result.insertId;

};


export const executeUpdateCropRange = async (
    connection,
    data
) => {

    await connection.query(
        `
        UPDATE crop_ranges
        SET
            crop_id = ?,
            crop_stage_id = ?,
            start_date = ?,
            end_date = ?,
            description = ?,
            is_active = ?
        WHERE id = ?
        `,
        [
            data.crop_id,
            data.crop_stage_id,
            data.start_date,
            data.end_date,
            data.description ?? null,
            data.is_active ? 1 : 0,
            data.id
        ]
    );

    return data.id;

};


export const executeDeactivateCropRange = async (
    connection,
    id
) => {

    await connection.query(
        `
        UPDATE crop_ranges
        SET is_active = 0
        WHERE id = ?
        `,
        [id]
    );

    return id;

};