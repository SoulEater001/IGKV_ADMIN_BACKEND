export const executeCreateCrop = async (
    connection,
    data
) => {

    const [[existing]] = await connection.query(
        `
        SELECT id
        FROM imd_m_crop
        WHERE imd_crop_name = ?
        `,
        [data.imd_crop_name]
    );

    if (existing) {
        throw new Error("Crop already exists.");
    }

    const [result] = await connection.query(
        `
        INSERT INTO imd_m_crop
        (
            imd_crop_name,
            imd_crop_name_h,
            imd_category_id
        )
        VALUES (?, ?, ?)
        `,
        [
            data.imd_crop_name,
            data.imd_crop_name_h,
            data.imd_category_id
        ]
    );

    await connection.query(
        `
        UPDATE imd_m_crop
        SET imd_crop_id = ?
        WHERE id = ?
        `,
        [
            result.insertId,
            result.insertId
        ]
    );

    return result.insertId;

};

export const executeDeleteCrop = async (connection, cropId) => {

    const [result] = await connection.query(
        `
        DELETE FROM imd_m_crop
        WHERE id = ?
        `,
        [cropId]
    );

    if (!result.affectedRows) {
        throw new Error("Crop not found.");
    }

    return cropId;

};