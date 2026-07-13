import { pool } from "../config/db.js"
import { logActivity } from '../utils/activityLogger.js'
import { ACTIONS } from "../constant/activityActions.js";
import { ENTITIES } from "../constant/activityEntities.js";

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
                    LOWER(b.name) LIKE ?
                    OR LOWER(d.name) LIKE ?
                    OR CAST(b.block_lg_code AS CHAR) LIKE ?
                )
            `;

            const keyword = `%${search.toLowerCase()}%`;

            params.push(
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
                b.create_datetime

            FROM m_block b

            LEFT JOIN m_district d
                ON b.district_id = d.district_id

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

        const [rows] = await pool.query(
            `
            SELECT *

            FROM m_block

            WHERE block_id = ?
              AND (
                    deleted IS NULL
                    OR deleted = 'N'
              )
            `,
            [id]
        );

        if (!rows.length) {

            return res.status(404).json({
                success: false,
                message: "Block not found."
            });

        }

        return res.status(200).json({
            success: true,
            data: rows[0]
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
    try {

        const {
            name,
            district_id,
            block_lg_code,
            latitude = null,
            longitude = null
        } = req.body;

        if (!name?.trim() || !district_id || !block_lg_code) {

            return res.status(400).json({
                success: false,
                message: "Name, District and LG Code are required."
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
              AND (
                    deleted IS NULL
                    OR deleted='N'
                  )
            `,
            [
                name.trim(),
                block_lg_code
            ]
        );

        if (existing) {

            return res.status(409).json({
                success: false,
                message: "Block already exists."
            });

        }

        const [result] = await pool.query(
            `
            INSERT INTO m_block
            (
                name,
                district_id,
                block_lg_code,
                latitude,
                longitude
            )
            VALUES (?, ?, ?, ?, ?)
            `,
            [
                name.trim(),
                district_id,
                block_lg_code,
                latitude,
                longitude
            ]
        );

        await logActivity({
            userId: req.user.id,
            action: ACTIONS.CREATE,
            entity: ENTITIES.BLOCK,
            entityId: result.insertId,
            description: `${req.user.name} created block ${name.trim()}`,
            ipAddress: req.ip
        });

        return res.status(201).json({
            success: true,
            message: "Block created successfully."
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to create block."
        });

    }
};

export const updateBlock = async (req, res) => {
    try {

        const { id } = req.params;

        const {
            name,
            district_id,
            block_lg_code,
            latitude = null,
            longitude = null
        } = req.body;

        if (!name?.trim() || !district_id || !block_lg_code) {

            return res.status(400).json({
                success: false,
                message: "Name, District and LG Code are required."
            });

        }

        const [[block]] = await pool.query(
            `
            SELECT block_id,
            block_lg_code,
            name

            FROM m_block

            WHERE block_id=?
            `,
            [id]
        );

        if (!block) {

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
                name.trim(),
                block_lg_code,
                id
            ]
        );

        if (existing) {

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
                longitude=?

            WHERE block_id=?
            `,
            [
                name.trim(),
                district_id,
                block_lg_code,
                latitude,
                longitude,
                id
            ]
        );

        const description =
            block.block_lg_code === block_lg_code
                ? `${req.user.name} updated block ${name.trim()}`
                : `${req.user.name} updated block ${name.trim()} and changed its LG code`;

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

        return res.status(500).json({
            success: false,
            message: "Failed to update block."
        });

    }
};

export const deleteBlock = async (req, res) => {
    try {

        const { id } = req.params;

        const [[block]] = await pool.query(
            `
            SELECT
                block_id,
                block_lg_code,
                name

            FROM m_block

            WHERE block_id=?
            `,
            [id]
        );

        if (!block) {

            return res.status(404).json({
                success: false,
                message: "Block not found."
            });

        }

        const [[mainUsage]] = await pool.query(
            `
            SELECT COUNT(*) AS total

            FROM imd_advisory_main

            WHERE block_lg_code=?
            `,
            [block.block_lg_code]
        );

        const [[detailUsage]] = await pool.query(
            `
            SELECT COUNT(*) AS total

            FROM imd_advisory_detail

            WHERE block_lg_code=?
            `,
            [block.block_lg_code]
        );

        if (mainUsage.total > 0 || detailUsage.total > 0) {

            return res.status(409).json({
                success: false,
                message: "Cannot delete block because it is used in advisories."
            });

        }

        await pool.query(
            `
            UPDATE m_block

            SET
                deleted='Y',
                delete_datetime=NOW()

            WHERE block_id=?
            `,
            [id]
        );

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

        return res.status(500).json({
            success: false,
            message: "Failed to delete block."
        });

    }
};