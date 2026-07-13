import { pool } from "../config/db.js";
import { logActivity } from '../utils/activityLogger.js'
import { ACTIONS } from "../constant/activityActions.js";
import { ENTITIES } from "../constant/activityEntities.js";

export const getCategories = async (req, res) => {
    try {

        const [rows] = await pool.query(`
            SELECT
                id,
                imd_category_id,
                img_category_name
            FROM imd_m_category
            ORDER BY id;
        `);

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch categories."
        });

    }
};

export const createCategory = async (req, res) => {
    try {
        const { img_category_name } = req.body;

        if (!img_category_name?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Category name is required."
            });
        }

        const [result] = await pool.query(
            `
            INSERT INTO imd_m_category
            (
                img_category_name
            )
            VALUES (?)
            `,
            [img_category_name.trim()]
        );

        const categoryId = result.insertId;

        await pool.query(
            `
            UPDATE imd_m_category
            SET imd_category_id = ?
            WHERE id = ?
            `,
            [categoryId, categoryId]
        );

        await logActivity({
            userId: req.user.id,
            action: ACTIONS.CREATE,
            entity: ENTITIES.CATEGORY,
            entityId: categoryId,
            description: `${req.user.name} created category ${img_category_name.trim()}`,
            ipAddress: req.ip
        });

        return res.status(201).json({
            success: true,
            message: "Category created successfully.",
            data: {
                id: categoryId,
                imd_category_id: categoryId
            }
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to create category."
        });

    }
};

export const updateCategory = async (req, res) => {
    try {

        const { id } = req.params;
        const { img_category_name } = req.body;

        if (!img_category_name?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Category name is required."
            });
        }

        const [rows] = await pool.query(
            `
            SELECT id, img_category_name
            FROM imd_m_category
            WHERE id = ?
            `,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Category not found."
            });
        }

        await pool.query(
            `
            UPDATE imd_m_category
            SET img_category_name = ?
            WHERE id = ?
            `,
            [
                img_category_name.trim(),
                id
            ]
        );
        await logActivity({
            userId: req.user.id,
            action: ACTIONS.UPDATE,
            entity: ENTITIES.CATEGORY,
            entityId: id,
            description: `${req.user.name} updated category ${img_category_name.trim()}`,
            ipAddress: req.ip
        });

        return res.status(200).json({
            success: true,
            message: "Category updated successfully."
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to update category."
        });

    }
};

export const deleteCategory = async (req, res) => {
    try {

        const { id } = req.params;

        const [[category]] = await pool.query(
            `
            SELECT
                id,
                img_category_name
            FROM imd_m_category
            WHERE id = ?
            `,
            [id]
        );

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found."
            });
        }

        const [[advisoryUsage]] = await pool.query(
            `
            SELECT COUNT(*) AS total
            FROM imd_advisory_detail
            WHERE cat_id = ?
            `,
            [id]
        );

        if (advisoryUsage.total > 0) {
            return res.status(409).json({
                success: false,
                message: "Cannot delete category because it is used by existing advisories."
            });
        }

        const [[cropUsage]] = await pool.query(
            `
            SELECT COUNT(*) AS total
            FROM imd_m_crop
            WHERE imd_category_id = ?
            `,
            [id]
        );

        if (cropUsage.total > 0) {
            return res.status(409).json({
                success: false,
                message: "Cannot delete category because it is assigned to existing crops."
            });
        }

        await pool.query(
            `
            DELETE FROM imd_m_category
            WHERE id = ?
            `,
            [id]
        );

        await logActivity({
            userId: req.user.id,
            action: ACTIONS.DELETE,
            entity: ENTITIES.CATEGORY,
            entityId: id,
            description: `${req.user.name} deleted category ${category.img_category_name}`,
            ipAddress: req.ip
        });

        return res.status(200).json({
            success: true,
            message: "Category deleted successfully."
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete category."
        });

    }
};