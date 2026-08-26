export const executeCreateCropStage = async (
    connection,
    data
) => {

    const [result] = await connection.query(
        `
        INSERT INTO crop_stages
        (
            stage_name,
            stage_name_h,
            stage_code,
            description,
            is_active
        )
        VALUES (?, ?, ?, ?, ?)
        `,
        [
            data.stage_name,
            data.stage_name_h,
            data.stage_code ?? null,
            data.description ?? null,
            data.is_active ? 1 : 0
        ]
    );

    return result.insertId;

};


export const executeUpdateCropStage = async (
    connection,
    data
) => {

    await connection.query(
        `
        UPDATE crop_stages
        SET
            stage_name = ?,
            stage_name_h = ?,
            stage_code = ?,
            description = ?,
            is_active = ?
        WHERE id = ?
        `,
        [
            data.stage_name,
            data.stage_name_h,
            data.stage_code ?? null,
            data.description ?? null,
            data.is_active ? 1 : 0,
            data.id
        ]
    );

    return data.id;

};


export const executeDeactivateCropStage = async (
    connection,
    id
) => {

    await connection.query(
        `
        UPDATE crop_stages
        SET is_active = 0
        WHERE id = ?
        `,
        [id]
    );

    return id;

};