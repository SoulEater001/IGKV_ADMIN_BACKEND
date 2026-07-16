import { pool } from "../config/db.js";
import { logActivity } from '../utils/activityLogger.js'
import { ACTIONS } from "../constant/activityActions.js";
import { ENTITIES } from "../constant/activityEntities.js";
import { requiresApproval } from '../utils/approval.js'
import { hasPendingApproval, createApprovalRequest } from '../services/approvalService.js'
import { executeCreateCategory, executeDeleteCategory, executeUpdateCategory } from "../services/categoryService.js";

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
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { img_category_name } = req.body;

        if (!img_category_name?.trim()) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: "Category name is required."
            });
        }

        const categoryData = {
            img_category_name: img_category_name.trim()
        };

        const [[existing]] = await connection.query(
            `
            SELECT id
            FROM imd_m_category
            WHERE img_category_name = ?
            `,
            [categoryData.img_category_name]
        );

        if (existing) {

            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: "Category already exists."
            });

        }

        if (requiresApproval(req.user)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.CATEGORY,
                ACTIONS.CREATE,
                {
                    img_category_name: categoryData.img_category_name
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "A category creation request with this name is already pending."
                });

            }

            await createApprovalRequest(connection, {
                resource: ENTITIES.CATEGORY,
                action: ACTIONS.CREATE,
                payload: categoryData,
                requestedBy: req.user.id
            });

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.CREATE,
                entity: ENTITIES.CATEGORY,
                entityId: req.user.id,
                description: `${req.user.name} requested creation of category ${categoryData.img_category_name}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message: "Category creation request sent for approval."
            });

        } else {
            const categoryId = await executeCreateCategory(
                connection,
                categoryData
            );

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.CREATE,
                entity: ENTITIES.CATEGORY,
                entityId: categoryId,
                description: `${req.user.name} created category ${categoryData.img_category_name}`,
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
        }
    } catch (error) {

        console.error(error);
        await connection.rollback();
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to create category."
        });

    } finally { connection.release(); }
};

export const updateCategory = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { id } = req.params;
        const { img_category_name } = req.body;

        if (!img_category_name?.trim()) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: "Category name is required."
            });
        }

        const [[category]] = await connection.query(
            `
            SELECT id, img_category_name
            FROM imd_m_category
            WHERE id = ?
            `,
            [id]
        );

        if (!category) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: "Category not found."
            });
        }


        const [[existing]] = await connection.query(
            `
            SELECT id
            FROM imd_m_category
            WHERE LOWER(img_category_name) = LOWER(?)
              AND id <> ?
            `,
            [
                img_category_name.trim(),
                id
            ]
        );

        if (existing) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: "Category already exists."
            });
        }
        const categoryData = {
            id: Number(id),
            img_category_name: img_category_name.trim()
        }

        if (requiresApproval(req.user)) {
            const pending = await hasPendingApproval(
                connection,
                ENTITIES.CATEGORY,
                ACTIONS.UPDATE,
                {
                    id: Number(id)
                }
            );

            if (pending) {
                await connection.rollback();
                return res.status(409).json({
                    success: false,
                    message: "A category update request is already pending approval."
                });
            }

            await createApprovalRequest(connection, {
                resource: ENTITIES.CATEGORY,
                action: ACTIONS.UPDATE,
                recordId: Number(id),
                payload: categoryData,
                requestedBy: req.user.id
            }
            );
            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.UPDATE,
                entityId: Number(id),
                entity: ENTITIES.CATEGORY,
                description: `${req.user.name} requested update of category ${img_category_name.trim()}`,
                ipAddress: req.ip
            });

            return res.status(202).json({
                success: true,
                approvalRequired: true,
                message: "Category update submitted for approval."
            });
        } else {
            await executeUpdateCategory(
                connection,
                categoryData
            );
            await connection.commit();
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
                approvalRequired: false,
                message: "Category updated successfully."
            });
        }
    } catch (error) {

        console.error(error);
        await connection.rollback();
        return res.status(500).json({
            success: false,
            message: "Failed to update category."
        });

    } finally { connection.release(); }
};

export const deleteCategory = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;

        const [[category]] = await connection.query(
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
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: "Category not found."
            });
        }

        const [[advisoryUsage]] = await connection.query(
            `
            SELECT COUNT(*) AS total
            FROM imd_advisory_detail
            WHERE cat_id = ?
            `,
            [id]
        );

        if (advisoryUsage.total > 0) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: "Cannot delete category because it is used by existing advisories."
            });
        }

        const [[cropUsage]] = await connection.query(
            `
            SELECT COUNT(*) AS total
            FROM imd_m_crop
            WHERE imd_category_id = ?
            `,
            [id]
        );

        if (cropUsage.total > 0) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: "Cannot delete category because it is assigned to existing crops."
            });
        }

        const payload = {
            id: category.id,
            img_category_name: category.img_category_name
        };

        if (requiresApproval(req.user)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.CATEGORY,
                ACTIONS.DELETE,
                {
                    id: category.id
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "A delete request for this category is already pending."
                });

            }

            await createApprovalRequest(connection, {
                resource: ENTITIES.CATEGORY,
                action: ACTIONS.DELETE,
                recordId: category.id,
                payload,
                requestedBy: req.user.id
            });

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.DELETE,
                entity: ENTITIES.CATEGORY,
                entityId: category.id,
                description: `${req.user.name} requested deletion of category ${category.img_category_name}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message: "Category deletion request sent for approval."
            });

        } else {
            const categoryId = await executeDeleteCategory(
                connection,
                category.id
            );

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.DELETE,
                entity: ENTITIES.CATEGORY,
                entityId: categoryId,
                description: `${req.user.name} deleted category ${category.img_category_name}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                message: "Category deleted successfully."
            });
        }
    } catch (error) {

        console.error(error);
        await connection.rollback();
        return res.status(500).json({
            success: false,
            message: "Failed to delete category."
        });

    } finally {
        connection.release();
    }
};  