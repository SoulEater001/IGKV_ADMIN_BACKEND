export const executeCreateCategory = async (
    connection,
    data
) => {
    const {
        img_category_name,
        imd_category_name_h
    } = data;

    const [[existing]] = await connection.query(
        `
        SELECT id
        FROM imd_m_category
        WHERE img_category_name = ?
        `,
        [img_category_name]
    );

    if (existing) {
        throw new Error("Category already exists.");
    }

    const [result] = await connection.query(
        `
        INSERT INTO imd_m_category
        (
            img_category_name,
            imd_category_name_h
        )
        VALUES (?, ?)
        `,
        [
            img_category_name,
            imd_category_name_h
        ]
    );

    await connection.query(
        `
        UPDATE imd_m_category
        SET imd_category_id = ?
        WHERE id = ?
        `,
        [
            result.insertId,
            result.insertId
        ]
    );

    return result.insertId;
};

export const executeDeleteCategory = async (
    connection,
    categoryId
) => {

    const [result] = await connection.query(
        `
        DELETE FROM imd_m_category
        WHERE id = ?
        `,
        [categoryId]
    );

    if (!result.affectedRows) {
        throw new Error("Category not found.");
    }

    return categoryId;

};

export const executeUpdateCategory = async (
    connection,
    data
) => {

    const {
        id,
        img_category_name,
        imd_category_name_h
    } = data;

    await connection.query(
        `
        UPDATE imd_m_category
        SET
            img_category_name = ?,
            imd_category_name_h = ?
        WHERE id = ?
        `,
        [
            img_category_name.trim(),
            imd_category_name_h.trim(),
            id
        ]
    );

    return id;
};