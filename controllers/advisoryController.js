import { pool } from "../config/db.js";
import { ACTIONS } from "../constant/activityActions.js";
import { ENTITIES } from "../constant/activityEntities.js";
import { logActivity } from '../utils/activityLogger.js'
import { hasPendingApproval, createApprovalRequest } from '../services/approvalService.js'
import { requiresApproval } from '../utils/approval.js'
import { executeCreateAdvisory, executeCreateBulkAdvisories, executeDeleteAdvisory, executeUpdateAdvisory } from "../services/advisoryService.js";
import validateLocationHierarchy from '../utils/validateLocationHierarchy.js'


export const getAdvisoriesPaginated = async (req, res) => {
    try {
        const {
            stateLgCode,
            districtLgCode,
            blockLgCode,
            categoryId,
            cropId,
            advisoryTypeId,
            languageId,
            fromDate,
            toDate,
            search = '',
            page = 1,
            limit = 10,
        } = req.query;

        if (fromDate && toDate) {

            const from = new Date(fromDate);
            const to = new Date(toDate);

            if (isNaN(from.getTime()) || isNaN(to.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid date format."
                });
            }

            if (from > to) {
                return res.status(400).json({
                    success: false,
                    message: "From date cannot be later than To date."
                });
            }

        }

        if (!stateLgCode || !languageId) {
            return res.status(400).json({
                success: false,
                message: "State and language is required.",
            });
        }

        const pageNumber = Number(page);
        const pageSize = Number(limit);
        const offset = (pageNumber - 1) * pageSize;
        const where = [
            "d.language_id = ?",
        ];

        const params = [
            languageId
        ];

        if (stateLgCode) {
            where.push("d.state_lg_code = ?");
            params.push(stateLgCode);
        }

        if (districtLgCode) {
            where.push("d.district_lg_code = ?");
            params.push(districtLgCode);
        }

        if (blockLgCode) {
            where.push("d.block_lg_code = ?");
            params.push(blockLgCode);
        }


        if (categoryId) {
            where.push("d.cat_id = ?");
            params.push(categoryId);
        }

        if (cropId) {
            where.push("d.crop_id = ?");
            params.push(cropId);
        }

        if (advisoryTypeId) {
            where.push("d.advisory_type_id = ?");
            params.push(advisoryTypeId);
        }

        if (fromDate) {
            where.push("DATE(m.advisory_date) >= ?");
            params.push(fromDate);
        }

        if (toDate) {
            where.push("DATE(m.advisory_date) <= ?");
            params.push(toDate);
        }

        const whereSql = where.join("\nAND ");

        let searchSql = "";

        if (search?.trim()) {

            searchSql = `
                AND (
                    CAST(d.id AS CHAR) LIKE ?
                    OR d.advisory LIKE ?
                    OR c.img_category_name LIKE ?
                    OR cr.imd_crop_name LIKE ?
                    OR cr.imd_crop_name_h LIKE ?
                    OR at.imd_advisory_type_name LIKE ?
                    OR DATE_FORMAT(m.advisory_date, '%d-%m-%Y') LIKE ?
                )
            `;

            const keyword = `%${search.trim()}%`;

            params.push(
                keyword, // id
                keyword, // advisory
                keyword, // category
                keyword, // crop english
                keyword, // crop hindi
                keyword, // advisory type
                keyword  // date
            );

        }

        // Total records
        const [[countResult]] = await pool.query(
            `
            SELECT COUNT(*) AS total
            FROM imd_advisory_detail d

            JOIN imd_advisory_main m
                ON d.advisory_main_id = m.id

            LEFT JOIN imd_m_category c
                ON d.cat_id = c.imd_category_id

            LEFT JOIN imd_advisory_type at
                ON d.advisory_type_id = at.imd_advisory_type_id
            
            LEFT JOIN imd_m_crop cr
                ON d.crop_id = cr.imd_crop_id

            WHERE
                ${whereSql}
                ${searchSql}
            `,
            params
        );

        // Fetch advisories
        const [rows] = await pool.query(
            `
            SELECT
                d.id,
                d.advisory,
                d.language_id,

                c.imd_category_id,
                c.img_category_name AS category,

                cr.imd_crop_id,
                cr.imd_crop_name,
                cr.imd_crop_name_h,

                at.imd_advisory_type_id,
                at.imd_advisory_type_name AS advisory_type,

                m.advisory_date,
                m.create_datetime

            FROM imd_advisory_detail d

            JOIN imd_advisory_main m
                ON d.advisory_main_id = m.id

            LEFT JOIN imd_m_category c
                ON d.cat_id = c.imd_category_id
            
            LEFT JOIN imd_m_crop cr
                ON d.crop_id = cr.imd_crop_id

            LEFT JOIN imd_advisory_type at
                ON d.advisory_type_id = at.imd_advisory_type_id

            WHERE 
                ${whereSql} 
                ${searchSql}

            ORDER BY m.advisory_date DESC, d.id DESC

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
            data: rows,
        });

    } catch (error) {
        console.error("Error fetching advisories:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch advisories.",
        });
    }
};

export const getPreviousAdvisories = async (req, res) => {

    try {

        const {
            stateLgCode,
            districtLgCodes,
            blockLgCodes,
            languageId,
            months
        } = req.query;
        // console.log(req.query)
        console.log(districtLgCodes)

        if (!stateLgCode || !languageId || !months) {

            return res.status(400).json({
                success: false,
                message: "State, language and month are required."
            });

        }

        const monthList = String(months)
            .split(',')
            .map(Number)
            .filter(
                month =>
                    Number.isInteger(month) &&
                    month >= 1 &&
                    month <= 12
            );

        if (monthList.length === 0) {

            return res.status(400).json({
                success: false,
                message: "Invalid month."
            });

        }

        const districtList = districtLgCodes
            ? String(districtLgCodes)
                .split(',')
                .map(Number)
                .filter(Number.isInteger)
            : [];

        const blockList = blockLgCodes
            ? String(blockLgCodes)
                .split(',')
                .map(Number)
                .filter(Number.isInteger)
            : [];

        const where = [
            "d.state_lg_code = ?",
            "d.language_id = ?"
        ];

        const params = [
            stateLgCode,
            languageId
        ];

        if (districtList.length > 0) {

            where.push(
                `d.district_lg_code IN (${districtList
                    .map(() => '?')
                    .join(', ')})`
            );

            params.push(...districtList);

        }

        if (blockList.length > 0) {

            where.push(
                `d.block_lg_code IN (${blockList
                    .map(() => '?')
                    .join(', ')})`
            );

            params.push(...blockList);

        }

        where.push(
            `MONTH(m.advisory_date) IN (${monthList
                .map(() => '?')
                .join(', ')})`
        );

        params.push(...monthList);

        const [rows] = await pool.query(
            `
            SELECT
                d.id,
                d.advisory_detail_id,
                d.advisory,
                d.language_id,

                d.state_lg_code,
                d.district_lg_code,
                d.block_lg_code,

                d.cat_id AS imd_category_id,
                c.img_category_name AS category,

                d.crop_id AS imd_crop_id,
                cr.imd_crop_name,
                cr.imd_crop_name_h,

                d.advisory_type_id AS imd_advisory_type_id,
                at.imd_advisory_type_name AS advisory_type,

                m.advisory_date,
                m.create_datetime

            FROM imd_advisory_detail d

            JOIN imd_advisory_main m
                ON d.advisory_main_id = m.id

            LEFT JOIN imd_m_category c
                ON d.cat_id = c.imd_category_id

            LEFT JOIN imd_m_crop cr
                ON d.crop_id = cr.imd_crop_id

            LEFT JOIN imd_advisory_type at
                ON d.advisory_type_id = at.imd_advisory_type_id

            WHERE ${where.join('\nAND ')}

            ORDER BY
                m.advisory_date DESC,
                d.id DESC

            LIMIT 100
            `,
            params
        );

        return res.status(200).json({
            success: true,
            data: rows
        });

    } catch (error) {

        console.error(
            "Error fetching previous advisories:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch previous advisories."
        });

    }

};

export const getPreviousAdvisoryByDetailId = async (req, res) => {

    try {

        const { advisoryDetailId } = req.params;

        if (!advisoryDetailId) {

            return res.status(400).json({
                success: false,
                message: "Advisory detail ID is required."
            });

        }

        const [rows] = await pool.query(
            `
            SELECT
                d.id,
                d.advisory_detail_id,

                d.state_lg_code,
                d.district_lg_code,
                d.block_lg_code,

                d.cat_id AS imd_category_id,
                d.crop_id,

                d.advisory_type_id AS imd_advisory_type_id,

                d.advisory,
                d.language_id,

                m.advisory_date

            FROM imd_advisory_detail d

            JOIN imd_advisory_main m
                ON d.advisory_main_id = m.id

            WHERE d.advisory_detail_id = ?

            ORDER BY d.language_id DESC
            `,
            [advisoryDetailId]
        );

        if (rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Previous advisory not found."
            });

        }

        const english = rows.find(
            row => row.language_id === 2
        );

        const hindi = rows.find(
            row => row.language_id === 1
        );

        return res.status(200).json({
            success: true,
            data: {
                advisory_detail_id: advisoryDetailId,

                state_lg_code:
                    english?.state_lg_code ??
                    hindi?.state_lg_code,

                district_lg_code:
                    english?.district_lg_code ??
                    hindi?.district_lg_code,

                block_lg_code:
                    english?.block_lg_code ??
                    hindi?.block_lg_code,

                imd_category_id:
                    english?.imd_category_id ??
                    hindi?.imd_category_id,

                crop_id:
                    english?.crop_id ??
                    hindi?.crop_id,

                imd_advisory_type_id:
                    english?.imd_advisory_type_id ??
                    hindi?.imd_advisory_type_id,

                advisory_date:
                    english?.advisory_date ??
                    hindi?.advisory_date,

                advisory_en: english?.advisory ?? '',
                advisory_hi: hindi?.advisory ?? ''
            }
        });

    } catch (error) {

        console.error(
            "Error fetching previous advisory:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch previous advisory."
        });

    }

};

export const createBulkAdvisories = async (req, res) => {
    const connection = await pool.getConnection();

    try {

        await connection.beginTransaction();

        const { advisories } = req.body;

        if (!Array.isArray(advisories) || advisories.length === 0) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "At least one advisory is required."
            });

        }

        for (const advisory of advisories) {

            const {
                state_lg_code,
                district_lg_code,
                block_lg_code,
                imd_category_id,
                crop_id,
                // language_id,
                advisory_en,
                advisory_hi,
                advisory_date
            } = advisory;
            // console.log(crop_id)

            if (
                !advisory_date ||
                !advisory_en?.trim() ||
                !advisory_hi?.trim()
            ) {

                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message: "Every advisory must contain date, English text and Hindi text."
                });

            }

            if (
                !validateLocationHierarchy(
                    state_lg_code,
                    district_lg_code,
                    block_lg_code
                )
            ) {

                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message: "Invalid location hierarchy."
                });

            }

            if (imd_category_id != null) {

                const [[category]] = await connection.query(
                    `
        SELECT imd_category_id
        FROM imd_m_category
        WHERE imd_category_id = ?
        LIMIT 1
        `,
                    [imd_category_id]
                );

                if (!category) {

                    await connection.rollback();

                    return res.status(400).json({
                        success: false,
                        message: "Invalid category."
                    });

                }

            }

            if (crop_id != null) {

                if (imd_category_id == null) {

                    await connection.rollback();

                    return res.status(400).json({
                        success: false,
                        message: "Crop cannot be selected without a category."
                    });

                }

                const [[crop]] = await connection.query(
                    `
        SELECT imd_crop_id
        FROM imd_m_crop
        WHERE
            imd_crop_id = ?
            AND imd_category_id = ?
        LIMIT 1
        `,
                    [
                        crop_id,
                        imd_category_id
                    ]
                );

                if (!crop) {

                    await connection.rollback();

                    return res.status(400).json({
                        success: false,
                        message: "Selected crop does not belong to the selected category."
                    });

                }

            }

        }


        const result = await executeCreateBulkAdvisories(
            connection,
            advisories
        );

        await connection.commit();
        // await connection.rollback();

        return res.status(201).json({
            success: true,
            message: `${result.advisoriesCreated} ${result.advisoriesCreated === 1
                ? "advisory"
                : "advisories"
                } created successfully.`,
            data: {
                mainRowsCreated: result.mainRowsCreated,
                advisoriesCreated: result.advisoriesCreated,
                languageRowsInserted: result.languageRowsInserted
            }
            // data: result
        });

    } catch (error) {

        console.error(error);

        await connection.rollback();

        return res.status(500).json({
            success: false,
            message: "Failed to create advisories."
        });

    } finally {
        connection.release();
    }
};

export const updateAdvisory = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;

        const {
            state_lg_code,
            district_lg_code,
            block_lg_code,
            imd_category_id,
            crop_id,
            imd_advisory_type_id,
            advisory,
            language_id
        } = req.body;

        if (
            language_id == null ||
            advisory == null ||
            advisory.trim() === ""
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Please fill all required fields."
            });
        }

        if (!validateLocationHierarchy(
            state_lg_code,
            district_lg_code,
            block_lg_code
        )) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Invalid location hierarchy."
            });
        }

        if (!imd_category_id && crop_id) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Crop cannot be selected without category."
            });
        }

        if (crop_id) {

            const [[crop]] = await connection.query(
                `
        SELECT imd_crop_id
        FROM imd_m_crop
        WHERE
            imd_crop_id = ?
            AND imd_category_id = ?
        `,
                [crop_id, imd_category_id]
            );

            if (!crop) {

                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message: "Selected crop doesn't belong to category."
                });

            }
        }

        const [[existing]] = await connection.query(
            `
                SELECT id
                FROM imd_advisory_detail
                WHERE id = ?
                `,
            [id]
        );

        if (!existing) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: "Advisory not found."
            });
        }

        const advisoryData = {
            id: Number(id),

            state_lg_code,
            district_lg_code: district_lg_code ?? null,
            block_lg_code: block_lg_code ?? null,

            imd_category_id: imd_category_id ?? null,
            crop_id: crop_id ?? null,

            imd_advisory_type_id,
            language_id,

            advisory: advisory.trim()
        };

        if (requiresApproval(req.user)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.ADVISORY,
                ACTIONS.UPDATE,
                {
                    id: Number(id)
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "An advisory update request is already pending."
                });

            }

            await createApprovalRequest(
                connection,
                {
                    resource: ENTITIES.ADVISORY,
                    action: ACTIONS.UPDATE,
                    recordId: Number(id),
                    payload: advisoryData,
                    requestedBy: req.user.id
                }
            );

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.UPDATE,
                entity: ENTITIES.ADVISORY,
                entityId: Number(id),
                description: `${req.user.name} requested update of an advisory`,
                ipAddress: req.ip
            });

            return res.status(202).json({
                success: true,
                approvalRequired: true,
                message: "Advisory update submitted for approval."
            });

        } else {
            await executeUpdateAdvisory(
                connection,
                advisoryData
            );

            await connection.commit();
            await logActivity({
                userId: req.user.id,
                action: ACTIONS.UPDATE,
                entity: ENTITIES.ADVISORY,
                entityId: id,
                description: `${req.user.name} updated an advisory`,
                ipAddress: req.ip
            });

            res.json({
                success: true,
                message: "Advisory updated successfully."
            });
        }
    } catch (error) {

        console.error(error);
        await connection.rollback();
        res.status(500).json({
            success: false,
            message: error.message || "Failed to update advisory."
        });

    } finally {
        connection.release();
    }
};

export const createAdvisory = async (req, res) => {
    const connection = await pool.getConnection();
    try {

        await connection.beginTransaction();
        const {
            state_lg_code,
            district_lg_code,
            block_lg_code,
            imd_category_id,
            crop_id,
            imd_advisory_type_id,
            language_id,
            advisory,
            advisory_date
        } = req.body;

        if (
            language_id == null ||
            advisory == null ||
            advisory_date == null ||
            advisory.trim() === ""
        ) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: "Please fill all required fields."
            });
        }

        if (!validateLocationHierarchy(
            state_lg_code,
            district_lg_code,
            block_lg_code
        )) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: "Invalid location hierarchy."
            });
        }

        if (!imd_category_id && crop_id) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: "Crop cannot be selected without category."
            });
        }

        if (crop_id) {

            const [[crop]] = await connection.query(
                `
        SELECT imd_crop_id
        FROM imd_m_crop
        WHERE
            imd_crop_id=?
            AND imd_category_id=?
        `,
                [crop_id, imd_category_id]
            );

            if (!crop) {

                return res.status(400).json({
                    success: false,
                    message: "Selected crop doesn't belong to category."
                });

            }

        }

        const advisoryData = {
            state_lg_code,
            district_lg_code: district_lg_code ?? null,
            block_lg_code: block_lg_code ?? null,
            imd_category_id: imd_category_id ?? null,
            crop_id: crop_id ?? null,
            imd_advisory_type_id,
            language_id,
            advisory: advisory.trim(),
            advisory_date
        };

        //
        // Find today's advisory_main row.
        // If none exists, create one.
        //
        if (requiresApproval(req.user)) {
            const pending = await hasPendingApproval(
                connection,
                ENTITIES.ADVISORY,
                ACTIONS.CREATE,
                {
                    advisory_date,
                    state_lg_code,
                    district_lg_code,
                    block_lg_code,
                    imd_category_id,
                    crop_id,
                    imd_advisory_type_id,
                    language_id
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "A similar advisory creation request is already pending."
                });

            }

            await createApprovalRequest(connection, {
                resource: ENTITIES.ADVISORY,
                action: ACTIONS.CREATE,
                payload: advisoryData,
                requestedBy: req.user.id
            });

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.CREATE,
                entity: ENTITIES.ADVISORY,
                entityId: req.user.id,
                description: `${req.user.name} requested creation of an advisory`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message: "Advisory creation request sent for approval."
            });

        } else {
            const advisoryId = await executeCreateAdvisory(
                connection,
                advisoryData
            );

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.CREATE,
                entity: ENTITIES.ADVISORY,
                entityId: advisoryId,
                description: `${req.user.name} created an advisory`,
                ipAddress: req.ip
            });

            res.status(201).json({
                success: true,
                message: "Advisory created successfully."
            });
        }
    } catch (error) {
        console.error(error);
        await connection.rollback();
        res.status(500).json({
            success: false,
            message: "Failed to create advisory."
        });
    } finally {
        connection.release();
    }
};

export const deleteAdvisory = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { id } = req.params;

        const [[advisory]] = await connection.query(
            `
            SELECT
                id,
                advisory_main_id
            FROM imd_advisory_detail
            WHERE id = ?
            `,
            [id]
        );

        if (!advisory) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: "Advisory not found."
            });
        }

        const payload = {
            id: advisory.id,
            advisory_main_id: advisory.advisory_main_id
        };

        if (requiresApproval(req.user)) {

            const pending = await hasPendingApproval(
                connection,
                ENTITIES.ADVISORY,
                ACTIONS.DELETE,
                {
                    id: advisory.id
                }
            );

            if (pending) {

                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "A delete request for this advisory is already pending."
                });

            }

            await createApprovalRequest(connection, {
                resource: ENTITIES.ADVISORY,
                action: ACTIONS.DELETE,
                recordId: advisory.id,
                payload,
                requestedBy: req.user.id
            });

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.DELETE,
                entity: ENTITIES.ADVISORY,
                entityId: advisory.id,
                description: `${req.user.name} requested deletion of an advisory`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                approvalRequired: true,
                message: "Advisory deletion request sent for approval."
            });

        } else {
            const advisoryId = await executeDeleteAdvisory(
                connection,
                advisory.id
            );

            await connection.commit();

            await logActivity({
                userId: req.user.id,
                action: ACTIONS.DELETE,
                entity: ENTITIES.ADVISORY,
                entityId: advisoryId,
                description: `${req.user.name} deleted an advisory`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                message: "Advisory deleted successfully."
            });
        }
    } catch (error) {

        console.error(error);
        await connection.rollback();
        return res.status(500).json({
            success: false,
            message: "Failed to delete advisory."
        });

    } finally {
        connection.release();
    }
};