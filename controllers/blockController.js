import { pool } from "../config/db.js"
import { logActivity } from '../utils/activityLogger.js'
import { ACTIONS } from "../constant/activityActions.js";
import { ENTITIES } from "../constant/activityEntities.js";
import { createApprovalRequest, hasPendingApproval } from "../services/approvalService.js";
import { requiresApproval } from "../utils/approval.js";

export const getBlocksByDistrict = async (req, res) => {
    try {
        const { districtId } = req.query;

        if (!districtId) {
            return res.status(400).json({
                success: false,
                message: "districtId is required."
            });
        }

        const [rows] = await pool.query(
            `
            SELECT
                block_id,
                name,
                block_lg_code
            FROM m_block
            WHERE district_id = ?
              AND deleted IS NULL
            ORDER BY name ASC
            `,
            [districtId]
        );

        return res.status(200).json({
            success: true,
            data: rows,
            count: rows.length
        });

    } catch (error) {
        console.error("Error fetching blocks:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch blocks.",
        });
    }
};

export const getBlocks = async (req, res) => {
    try {

        const {
            page = 1,
            limit = 10,
            search = ""
        } = req.query;

        const pageNumber = Number(page);

        const pageSize = Number(limit);

        const offset = (pageNumber - 1) * pageSize;

        let where = `
            WHERE (
                b.deleted IS NULL
                OR b.deleted = 'N'
            )
        `;

        const params = [];

        if (search.trim()) {

            where += `
                AND (
                    LOWER(en.name) LIKE LOWER(?)
                    OR LOWER(b.name) LIKE LOWER(?)
                    OR LOWER(d.name) LIKE LOWER(?)
                    OR CAST(b.block_lg_code AS CHAR) LIKE ?
                )
            `;

            const keyword = `%${search.toLowerCase()}%`;

            params.push(
                keyword,
                keyword,
                keyword,
                keyword
            );

        }

        const [[countResult]] = await pool.query(
            `
             SELECT COUNT(*) AS total

            FROM m_block b

            LEFT JOIN m_district d
                ON b.district_id = d.district_id
            LEFT JOIN m_block_language en
                ON en.block_id = b.block_id
                AND en.language_id = 2
                AND en.deleted IS NULL
            ${where}
            `,
            params
        );

        const [rows] = await pool.query(
            `
            SELECT
                b.block_id,
                b.name,
                b.block_lg_code,
                b.latitude,
                b.longitude,
                b.district_id,
                d.name AS district_name,
                b.create_datetime,

                en.name AS name_en

            FROM m_block b

            LEFT JOIN m_district d
                ON b.district_id = d.district_id
                and B.deleted IS NULL

            LEFT JOIN m_block_language en
                ON en.block_id = b.block_id
               AND en.language_id = 2
               AND en.deleted IS NULL

            ${where}

            ORDER BY b.name ASC

            LIMIT ?

            OFFSET ?
            `,
            [
                ...params,
                pageSize,
                offset
            ]
        );
        console.log(countResult.total / pageSize)

        return res.status(200).json({
            success: true,
            page: pageNumber,
            limit: pageSize,
            total: countResult.total,
            totalPages: Math.ceil(countResult.total / pageSize),
            data: rows
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch blocks."
        });

    }
};

export const getBlockById = async (req, res) => {
    try {

        const { id } = req.params;

        const [[block]] = await pool.query(
            `
             SELECT
                b.block_id,
                b.district_id,
                b.block_lg_code,
                b.latitude,
                b.longitude,
                b.create_datetime,

                d.name AS district_name,

                en.name AS name_en,
                hi.name AS name_hi

            FROM m_block b

            LEFT JOIN m_district d
                ON d.district_id = b.district_id

            LEFT JOIN m_block_language en
                ON en.block_id = b.block_id
               AND en.language_id = 2
               AND en.deleted IS NULL

            LEFT JOIN m_block_language hi
                ON hi.block_id = b.block_id
               AND hi.language_id = 1
               AND hi.deleted IS NULL

            WHERE
                b.block_id = ?
                AND (
                    b.deleted IS NULL
                    OR b.deleted = 'N'
                )
            `,
            [id]
        );

        if (!block) {

            return res.status(404).json({
                success: false,
                message: "Block not found."
            });

        }

        return res.status(200).json({
            success: true,
            data: block
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch block."
        });

    }
};

export const createBlock = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const {
            name_en,
            name_hi,
            district_id,
            block_lg_code,
            latitude = null,
            longitude = null
        } = req.body;

        if (!name_en?.trim() || !name_hi?.trim() || !district_id || !block_lg_code) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: "Name, District and LG Code are required."
            });

        }

        const [[existing]] = await connection.query(
            `
            SELECT block_id

            FROM m_block

            WHERE (
                    LOWER(name)=LOWER(?)
                    OR block_lg_code=?
                  )
              AND (
                    deleted IS NULL
                    OR deleted='N'
                  )
            `,
            [
                name_en.trim(),
                block_lg_code
            ]
        );

        if (existing) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: "Block already exists."
            });

        }

        const [result] = await connection.query(
            `
            INSERT INTO m_block
            (
                name,
                district_id,
                block_lg_code,
                latitude,
                longitude,
                create_by
            )
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                name_en.trim(),
                district_id,
                block_lg_code,
                latitude,
                longitude,
                req.user.id
            ]
        );
        const blockId = result.insertId;
        await connection.query(
            `
            INSERT INTO m_block_language
            (
                block_id,
                language_id,
                name,
                create_by
            )
            VALUES
                (? , 2, ?, ?),
                (?, 1, ?, ?)
            `,
            [
                blockId,
                name_en.trim(),
                req.user.id,

                blockId,
                name_hi.trim(),
                req.user.id
            ]
        );

        await connection.commit();

        await logActivity({
            userId: req.user.id,
            action: ACTIONS.CREATE,
            entity: ENTITIES.BLOCK,
            entityId: blockId,
            description: `${req.user.name} created block ${name_en.trim()}`,
            ipAddress: req.ip
        });

        return res.status(201).json({
            success: true,
            message: "Block created successfully."
        });

    } catch (error) {

        console.error(error);
        await connection.rollback();
        return res.status(500).json({
            success: false,
            message: "Failed to create block."
        });

    } finally {
        connection.release();
    }
};

export const updateBlock = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;

        const {
            name_en,
            name_hi,
            district_id,
            block_lg_code,
            latitude = null,
            longitude = null
        } = req.body;

        if (!name_hi?.trim() || !name_en?.trim() || !district_id || !block_lg_code) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: "English name, Hindi name, District and LG Code are required."
            });

        }

        const [[block]] = await pool.query(
            `
            SELECT block_id,
            block_lg_code,
            name

            FROM m_block

            WHERE block_id=?
             AND deleted IS NULL
            `,
            [id]
        );

        if (!block) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: "Block not found."
            });

        }

        const [[existing]] = await pool.query(
            `
            SELECT block_id

            FROM m_block

            WHERE (
                    LOWER(name)=LOWER(?)
                    OR block_lg_code=?
                  )
              AND block_id<>?
              AND (
                    deleted IS NULL
                    OR deleted='N'
                  )
            `,
            [
                name_en.trim(),
                block_lg_code,
                id
            ]
        );

        if (existing) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: "Block already exists."
            });

        }

        if (block.block_lg_code !== block_lg_code) {

            await pool.query(
                `
                UPDATE imd_advisory_main
                SET block_lg_code=?
                WHERE block_lg_code=?
                `,
                [
                    block_lg_code,
                    block.block_lg_code
                ]
            );

            await pool.query(
                `
                UPDATE imd_advisory_detail
                SET block_lg_code=?
                WHERE block_lg_code=?
                `,
                [
                    block_lg_code,
                    block.block_lg_code
                ]
            );

        }

        await pool.query(
            `
            UPDATE m_block

            SET
                name=?,
                district_id=?,
                block_lg_code=?,
                latitude=?,
                longitude=?,
                modify_by = ?,
                modify_datetime = NOW()

            WHERE block_id=?
            `,
            [
                name_en.trim(),
                district_id,
                block_lg_code,
                latitude,
                longitude,
                req.user.id,
                id
            ]
        );

        await connection.query(
            `
            UPDATE m_block_language
            SET
                name = ?,
                modify_by = ?,
                modify_datetime = NOW()
            WHERE
                block_id = ?
                AND language_id = 2
                AND deleted IS NULL
            `,
            [
                name_en.trim(),
                req.user.id,
                id
            ]
        );

        await connection.query(
            `
            UPDATE m_block_language
            SET
                name = ?,
                modify_by = ?,
                 modify_datetime = NOW()
            WHERE
                block_id = ?
                AND language_id = 1
                AND deleted IS NULL
            `,
            [
                name_hi.trim(),
                req.user.id,
                id
            ]
        );

        await connection.commit();


        const description =
            block.block_lg_code === block_lg_code
                ? `${req.user.name} updated block ${name_en.trim()}`
                : `${req.user.name} updated block ${name_en.trim()} and changed its LG code`;

        await logActivity({
            userId: req.user.id,
            action: ACTIONS.UPDATE,
            entity: ENTITIES.BLOCK,
            entityId: id,
            description,
            ipAddress: req.ip
        });

        return res.status(200).json({
            success: true,
            message: "Block updated successfully."
        });

    } catch (error) {

        console.error(error);
        await connection.rollback();
        return res.status(500).json({
            success: false,
            message: "Failed to update block."
        });

    } finally {
        connection.release();
    }
};

export const deleteBlock = async (req, res) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();
        const { id } = req.params;

        const [[block]] = await connection.query(
            `
            SELECT
                block_id,
                block_lg_code,
                name

            FROM m_block

            WHERE block_id=?
            AND deleted IS NULL
            `,
            [id]
        );

        if (!block) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: "Block not found."
            });

        }

        const [[mainUsage]] = await connection.query(
            `
            SELECT COUNT(*) AS total

            FROM imd_advisory_main

            WHERE block_lg_code=?
            `,
            [block.block_lg_code]
        );

        const [[detailUsage]] = await connection.query(
            `
            SELECT COUNT(*) AS total

            FROM imd_advisory_detail

            WHERE block_lg_code=?
            `,
            [block.block_lg_code]
        );

        if (mainUsage.total > 0 || detailUsage.total > 0) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: "Cannot delete block because it is used in advisories."
            });

        }

        await connection.query(
            `
            UPDATE m_block

            SET
                deleted='Y',
                 delete_by = ?,
                delete_datetime=NOW()

            WHERE block_id=?
                AND deleted IS NULL
            `,
            [req.user.id,id]
        );

        await connection.query(
            `
            UPDATE m_block_language
            SET
                deleted = 'Y',
                delete_by = ?,
                delete_datetime = NOW()
            WHERE
                block_id = ?
                AND deleted IS NULL
            `,
            [
                req.user.id,
                id
            ]
        );

        await connection.commit();


        await logActivity({
            userId: req.user.id,
            action: ACTIONS.DELETE,
            entity: ENTITIES.BLOCK,
            entityId: id,
            description: `${req.user.name} deleted block ${block.name}`,
            ipAddress: req.ip
        });

        return res.status(200).json({
            success: true,
            message: "Block deleted successfully."
        });

    } catch (error) {

        console.error(error);
        await connection.rollback();
        return res.status(500).json({
            success: false,
            message: "Failed to delete block."
        });

    } finally {
        connection.release();
    }
};