import { pool } from "../config/db.js";
import { ACTIONS } from "../constant/activityActions.js";
import { ENTITIES } from "../constant/activityEntities.js";
import { logActivity } from '../utils/activityLogger.js'
import { hasPendingApproval, createApprovalRequest } from '../services/approvalService.js'
import { requiresApproval } from '../utils/approval.js'
import { executeCreateAdvisory, executeCreateBulkAdvisories, executeDeleteAdvisory, executeUpdateAdvisory } from "../services/advisoryService.js";
import validateLocationHierarchy from '../utils/validateLocationHierarchy.js'
import { isValidIsoDate } from "../utils/weatherUtils.js";


export const getAdvisoriesPaginated = async (req, res) => {
    try {
        const {
            stateLgCode,
            districtLgCode,
            blockLgCode,
            categoryId,
            cropId,
            cropStageId,
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
            "d.language_Id = ?",
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

        if (cropStageId) {
            where.push("d.crop_stage_id = ?");
            params.push(cropStageId);
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
            LOWER(CAST(d.id AS CHAR)) LIKE LOWER(?)
            OR LOWER(d.advisory) LIKE LOWER(?)
            OR LOWER(c.img_category_name) LIKE LOWER(?)
            OR LOWER(cr.imd_crop_name) LIKE LOWER(?)
            OR LOWER(cr.imd_crop_name_h) LIKE LOWER(?)
            OR LOWER(cs.stage_name) LIKE LOWER(?)
            OR LOWER(cs.stage_name_h) LIKE LOWER(?)
            OR LOWER(cs.stage_code) LIKE LOWER(?)
            OR LOWER(at.imd_advisory_type_name) LIKE LOWER(?)
            OR LOWER(DATE_FORMAT(m.advisory_date, '%d-%m-%Y')) LIKE LOWER(?)
        )
    `;

            const keyword = `%${search.trim()}%`;

            params.push(
                keyword, // advisory id
                keyword, // advisory
                keyword, // category
                keyword, // crop english
                keyword, // crop hindi
                keyword, // crop stage english
                keyword, // crop stage hindi
                keyword, // crop stage code
                keyword, // advisory type
                keyword  // date
            );
        }

        const [[countResult]] = await pool.query(
            `
            SELECT COUNT(*) AS total
            FROM imd_advisory_detail d

            JOIN imd_advisory_main m
                ON d.advisory_main_id = m.id

            LEFT JOIN imd_m_category c
                ON d.cat_id = c.imd_category_id

            LEFT JOIN imd_m_crop cr
                ON d.crop_id = cr.imd_crop_id

            LEFT JOIN crop_stages cs
                ON d.crop_stage_id = cs.id

            LEFT JOIN imd_advisory_type at
                ON d.advisory_type_id = at.imd_advisory_type_id

            WHERE
                ${whereSql}
                ${searchSql}
            `,
            params
        );

        const [rows] = await pool.query(
            `
            SELECT
                d.id,
                d.advisory,
                d.language_Id AS language_id,

                d.state_lg_code,
                d.district_lg_code,
                d.block_lg_code,

                c.imd_category_id,
                c.img_category_name AS category,

                cr.imd_crop_id,
                cr.imd_crop_name,
                cr.imd_crop_name_h,

                cs.id AS crop_stage_id,
                cs.stage_name AS crop_stage,
                cs.stage_name_h AS crop_stage_h,
                cs.stage_code AS crop_stage_code,

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

            LEFT JOIN crop_stages cs
                ON d.crop_stage_id = cs.id

            LEFT JOIN imd_advisory_type at
                ON d.advisory_type_id = at.imd_advisory_type_id

            WHERE
                ${whereSql}
                ${searchSql}

            ORDER BY
                m.advisory_date DESC,
                d.id DESC

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
            total: Number(countResult.total),
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

export const getPreviousAdvisoryOptions = async (req, res) => {
    try {
        const {
            stateLgCode,
            districtLgCodes,
            blockLgCodes,
            dates
        } = req.query;

        if (!stateLgCode || !dates) {
            return res.status(400).json({
                success: false,
                message: 'State and dates are required.'
            });
        }

        const dateList = String(dates)
            .split(',')
            .map(value => value.trim())
            .filter(Boolean);

        if (dateList.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid dates.'
            });
        }

        const monthYearMap = new Map();

        for (const value of dateList) {
            const date = new Date(`${value}T00:00:00`);

            if (Number.isNaN(date.getTime())) {
                continue;
            }

            const month = date.getMonth() + 1;
            const currentYear = date.getFullYear();
            const previousYear = currentYear - 1;

            monthYearMap.set(
                `${currentYear}-${month}`,
                {
                    year: currentYear,
                    month
                }
            );

            monthYearMap.set(
                `${previousYear}-${month}`,
                {
                    year: previousYear,
                    month
                }
            );
        }

        const targetPeriods = [...monthYearMap.values()];

        if (targetPeriods.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid date periods found.'
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
            'd.state_lg_code = ?'
        ];

        const params = [
            Number(stateLgCode)
        ];

        if (blockList.length > 0) {

            // BLOCK-LEVEL previous advisories
            where.push(`
                d.district_lg_code IS NOT NULL
            `);

            where.push(`
                d.block_lg_code IS NOT NULL
            `);

        } else {

            // DISTRICT-LEVEL previous advisories
            where.push(`
                d.district_lg_code IS NOT NULL
            `);

            where.push(`
                d.block_lg_code IS NULL
            `);

        }

        const periodConditions = targetPeriods
            .map(() => `
                (
                    YEAR(m.advisory_date) = ?
                    AND MONTH(m.advisory_date) = ?
                )
            `)
            .join(' OR ');

        where.push(`
            (
                ${periodConditions}
            )
        `);

        targetPeriods.forEach(period => {
            params.push(
                period.year,
                period.month
            );
        });

        const [rows] = await pool.query(
            `
            SELECT
                DATE_FORMAT(
                    m.advisory_date,
                    '%Y-%m-%d'
                ) AS advisory_date,

                d.state_lg_code,
                d.district_lg_code,
                d.block_lg_code,

                COUNT(
                    DISTINCT d.advisory_detail_id
                ) AS advisory_count

            FROM imd_advisory_detail d

            JOIN imd_advisory_main m
                ON d.advisory_main_id = m.id

            WHERE ${where.join('\nAND ')}

            GROUP BY
                m.advisory_date,
                d.state_lg_code,
                d.district_lg_code,
                d.block_lg_code

            ORDER BY
                m.advisory_date DESC,
                d.state_lg_code ASC,
                d.district_lg_code ASC,
                d.block_lg_code ASC
            `,
            params
        );

        const data = rows.map(row => ({
            advisory_date: row.advisory_date,

            state_lg_code:
                row.state_lg_code !== null
                    ? Number(row.state_lg_code)
                    : null,

            district_lg_code:
                row.district_lg_code !== null
                    ? Number(row.district_lg_code)
                    : null,

            block_lg_code:
                row.block_lg_code !== null
                    ? Number(row.block_lg_code)
                    : null,

            advisory_count:
                Number(row.advisory_count)
        }));

        console.log(
            'previous advisory options:',
            data
        );

        return res.status(200).json({
            success: true,
            data
        });

    } catch (error) {
        console.error(
            'Error fetching previous advisory options:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                'Failed to fetch previous advisory options.'
        });
    }
};

export const loadPreviousAdvisories = async (req, res) => {
    try {
        const {
            advisoryOptions
        } = req.query;

        let options = [];

        try {
            options = advisoryOptions
                ? JSON.parse(advisoryOptions)
                : [];
        } catch {
            return res.status(400).json({
                success: false,
                message: 'Invalid advisoryOptions'
            });
        }

        if (
            !Array.isArray(options) ||
            options.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'At least one advisory option is required'
            });
        }

        // ------------------------------------------
        // Validate options
        // ------------------------------------------

        for (const option of options) {
            if (!isValidIsoDate(option.advisory_date)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid advisory date'
                });
            }

            if (
                option.state_lg_code == null ||
                option.district_lg_code == null
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'State and district LG codes are required'
                });
            }
        }

        // ------------------------------------------
        // Build exact date + location conditions
        // ------------------------------------------

        const conditions = [];
        const queryParams = [];

        for (const option of options) {
            let condition = `
        (
            DATE(m.advisory_date) = ?
            AND d.state_lg_code = ?
            AND d.district_lg_code = ?
    `;

            queryParams.push(
                option.advisory_date,
                option.state_lg_code,
                option.district_lg_code
            );

            if (option.block_lg_code == null) {
                condition += `
            AND d.block_lg_code IS NULL
        `;
            } else {
                condition += `
            AND d.block_lg_code = ?
        `;

                queryParams.push(
                    option.block_lg_code
                );
            }

            condition += `
        )
    `;

            conditions.push(condition);
        }

        // ------------------------------------------
        // Fetch advisories
        // ------------------------------------------

        const [rows] = await pool.query(
            `
            SELECT
                d.advisory_detail_id,
                d.state_lg_code,
                d.district_lg_code,
                d.block_lg_code,
                d.cat_id AS imd_category_id,
                d.crop_id,
                d.crop_stage_id,
                d.advisory_type_id AS imd_advisory_type_id,
                d.advisory,
                d.language_id,

                DATE_FORMAT(
                    m.advisory_date,
                    '%Y-%m-%d'
                ) AS advisory_date

            FROM imd_advisory_detail d

            JOIN imd_advisory_main m
                ON d.advisory_main_id = m.id

            WHERE
                ${conditions.join(' OR ')}

            ORDER BY
                m.advisory_date DESC,
                d.state_lg_code ASC,
                d.district_lg_code ASC,
                d.block_lg_code ASC,
                d.advisory_detail_id ASC,
                d.language_id DESC
            `,
            queryParams
        );

        // ------------------------------------------
        // Group English + Hindi
        // ------------------------------------------

        const advisoryMap = new Map();

        rows.forEach(row => {
            if (!advisoryMap.has(row.advisory_detail_id)) {
                advisoryMap.set(
                    row.advisory_detail_id,
                    {
                        advisory_detail_id:
                            row.advisory_detail_id,

                        state_lg_code:
                            row.state_lg_code,

                        district_lg_code:
                            row.district_lg_code,

                        block_lg_code:
                            row.block_lg_code,

                        imd_category_id:
                            row.imd_category_id,

                        crop_id:
                            row.crop_id,

                        crop_stage_id:
                            row.crop_stage_id,

                        imd_advisory_type_id:
                            row.imd_advisory_type_id,

                        advisory_date:
                            row.advisory_date,

                        advisory_en: '',
                        advisory_hi: ''
                    }
                );
            }

            const advisory =
                advisoryMap.get(
                    row.advisory_detail_id
                );

            if (row.language_id === 2) {
                advisory.advisory_en =
                    row.advisory;
            }

            if (row.language_id === 1) {
                advisory.advisory_hi =
                    row.advisory;
            }
        });

        return res.status(200).json({
            success: true,
            data: Array.from(
                advisoryMap.values()
            )
        });

    } catch (error) {
        console.error(
            'Error loading previous advisories:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                'Failed to load previous advisories.'
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
                crop_stage_id,
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

                if (crop_stage_id != null && crop_id == null) {
                    await connection.rollback();
                    return res.status(400).json({
                        success: false,
                        message: "Crop stage cannot be selected without a crop."
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
            crop_stage_id,
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
            crop_stage_id: crop_stage_id ?? null,

            imd_advisory_type_id,
            language_id,

            advisory: advisory.trim()
        };

        if (await requiresApproval(connection, req.user.id)) {
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

            return res.json({
                success: true,
                message: "Advisory updated successfully."
            });
        }

    } catch (error) {
        console.error(error);

        await connection.rollback();

        return res.status(500).json({
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
            crop_stage_id,
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

        const advisoryData = {
            state_lg_code,
            district_lg_code: district_lg_code ?? null,
            block_lg_code: block_lg_code ?? null,

            imd_category_id: imd_category_id ?? null,
            crop_id: crop_id ?? null,
            crop_stage_id: crop_stage_id ?? null,

            imd_advisory_type_id,
            language_id,
            advisory: advisory.trim(),
            advisory_date
        };

        if (await requiresApproval(connection, req.user.id)) {
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
                    crop_stage_id,
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

            await createApprovalRequest(
                connection,
                {
                    resource: ENTITIES.ADVISORY,
                    action: ACTIONS.CREATE,
                    payload: advisoryData,
                    requestedBy: req.user.id
                }
            );

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

            return res.status(201).json({
                success: true,
                message: "Advisory created successfully."
            });
        }

    } catch (error) {
        console.error(error);

        await connection.rollback();

        return res.status(500).json({
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

        if (await requiresApproval(connection, req.user.id)) {

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

export const createAdvisoryMain = async (req, res) => {
    let connection;

    try {
        const { advisory_date } = req.body;

        if (!advisory_date) {
            return res.status(400).json({
                success: false,
                message: "advisory_date is required",
            });
        }

        connection = await pool.getConnection();

        await connection.beginTransaction();

        // 1. Check if advisory already exists

        const [existingRows] = await connection.execute(
            `
                SELECT id
                FROM imd_advisory_main
                WHERE DATE(advisory_date) = DATE(?)
                LIMIT 1
            `,
            [advisory_date]
        );

        // 2. If exists, return existing ID

        if (existingRows.length > 0) {

            await connection.commit();

            return res.status(200).json({
                success: true,
                data: {
                    id: existingRows[0].id,
                    existing: true,
                },
            });
        }

        // 3. Create new advisory main
        // LG codes intentionally remain NULL

        const [insertResult] = await connection.execute(
            `
                INSERT INTO imd_advisory_main (
                    advisory_date,
                    create_datetime
                )
                VALUES (?, NOW())
            `,
            [advisory_date]
        );

        const id = insertResult.insertId;

        // 4. Copy generated ID to advisory_main_id

        await connection.execute(
            `
                UPDATE imd_advisory_main
                SET advisory_main_id = ?
                WHERE id = ?
            `,
            [id, id]
        );

        await connection.commit();

        return res.status(201).json({
            success: true,
            data: { id, existing: false, },
        });

    } catch (error) {

        if (connection) {
            await connection.rollback();
        }

        console.error("Failed to create advisory main:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create advisory main",
        });

    } finally {

        if (connection) {
            connection.release();
        }

    }
};

export const submitAdvisoryWizard = async (req, res) => {
    let connection;

    try {
        const {
            advisory_date,
            station_id,
            state_lg_code,
            district_lg_code,
            block_lg_code,
            observations = [],
            forecasts = [],
            observation_summary,
            forecast_summary,
            advisories = [],
        } = req.body;
        // console.log("Wizard body : ", req.body)
        if (!advisory_date) {
            return res.status(400).json({
                success: false,
                message: "advisory_date is required.",
            });
        }

        if (!station_id) {
            return res.status(400).json({
                success: false,
                message: "station_id is required.",
            });
        }

        if (!state_lg_code || !district_lg_code) {
            return res.status(400).json({
                success: false,
                message: "Valid state_lg_code and district_lg_code are required.",
            });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Validate station
        const [stationRows] = await connection.execute(
            `SELECT id
       FROM weather_station
       WHERE id = ? AND is_active = 1
       LIMIT 1`,
            [station_id]
        );

        if (stationRows.length === 0) {
            throw new Error("Invalid or inactive station.");
        }

        // 2. Validate district
        const [districtRows] = await connection.execute(
            `SELECT district_id
       FROM m_district
       WHERE district_lg_code = ?
       LIMIT 1`,
            [district_lg_code]
        );

        if (districtRows.length === 0) {
            throw new Error("Invalid district.");
        }

        // 3. Validate block when provided
        if (block_lg_code !== null && block_lg_code !== undefined) {
            const [blockRows] = await connection.execute(
                `SELECT block_id
         FROM m_block
         WHERE block_lg_code = ?
         LIMIT 1`,
                [block_lg_code]
            );

            if (blockRows.length === 0) {
                throw new Error("Invalid block.");
            }
        }

        // 4. Insert advisory main
        const [mainResult] = await connection.execute(
            `INSERT INTO imd_advisory_main (
        advisory_main_id,
        advisory_date,
        create_datetime
      ) VALUES (NULL, ?, NOW())`,
            [
                advisory_date,
            ]
        );

        const advisory_main_id = mainResult.insertId;

        // advisory_main_id must be equal to its own id
        await connection.execute(
            `UPDATE imd_advisory_main
       SET advisory_main_id = ?
       WHERE id = ?`,
            [advisory_main_id, advisory_main_id]
        );

        // 5. Save observations only when observations are provided
        if (Array.isArray(observations) && observations.length > 0) {
            for (const observation of observations) {
                await connection.execute(
                    `INSERT INTO weather_observation (
            station_id,
            observation_issue_date,
            observation_date,
            max_temperature,
            min_temperature,
            rainfall,
            relative_humidity_1,
            relative_humidity_2,
            vapour_pressure_1,
            vapour_pressure_2,
            wind_speed,
            evaporation,
            sunshine_hours
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        observation.station_id ?? station_id,
                        observation.observation_issue_date ?? advisory_date,
                        observation.observation_date,
                        observation.max_temperature ?? null,
                        observation.min_temperature ?? null,
                        observation.rainfall ?? null,
                        observation.relative_humidity_1 ?? null,
                        observation.relative_humidity_2 ?? null,
                        observation.vapour_pressure_1 ?? null,
                        observation.vapour_pressure_2 ?? null,
                        observation.wind_speed ?? null,
                        observation.evaporation ?? null,
                        observation.sunshine_hours ?? null,
                    ]
                );
            }
        }

        // 6. Save observation summary unless existing data is reused
        if (observation_summary?.reuse_existing !== true) {
            const observationIssueDate =
                observations?.[0]?.observation_issue_date ?? advisory_date;

            await connection.execute(
                `INSERT INTO weather_observation_summary (
          station_id,
          observation_issue_date,
          summary_en,
          summary_hi
        ) VALUES (?, ?, ?, ?)`,
                [
                    station_id,
                    observationIssueDate,
                    observation_summary?.summary_en ?? null,
                    observation_summary?.summary_hi ?? null,
                ]
            );
        }

        // 7. Save forecasts with the newly created advisory_main_id
        if (Array.isArray(forecasts) && forecasts.length > 0) {
            for (const forecast of forecasts) {
                await connection.execute(
                    `INSERT INTO weather_forecast (
            advisory_main_id,
            station_id,
            forecast_issue_date,
            forecast_date,
            rainfall,
            max_temperature,
            min_temperature,
            cloud_amount,
            relative_humidity_1,
            relative_humidity_2,
            wind_speed,
            wind_direction,
            state_lg_code,
            district_lg_code,
            block_lg_code
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        advisory_main_id,
                        forecast.station_id ?? station_id,
                        forecast.forecast_issue_date ?? advisory_date,
                        forecast.forecast_date,
                        forecast.rainfall ?? null,
                        forecast.max_temperature ?? null,
                        forecast.min_temperature ?? null,
                        forecast.cloud_amount ?? null,
                        forecast.relative_humidity_1 ?? null,
                        forecast.relative_humidity_2 ?? null,
                        forecast.wind_speed ?? null,
                        forecast.wind_direction ?? null,
                        forecast.state_lg_code ?? state_lg_code,
                        forecast.district_lg_code ?? district_lg_code,
                        forecast.block_lg_code ?? block_lg_code ?? null,
                    ]
                );
            }
        }

        // 8. Save forecast summary
        if (forecast_summary) {
            await connection.execute(
                `INSERT INTO weather_forecast_summary (
          advisory_main_id,
           forecast_issue_date,
          state_lg_code,
          district_lg_code,
          block_lg_code,
          summary_en,
          summary_hi
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    advisory_main_id,
                    advisory_date,
                    forecast_summary.state_lg_code ?? state_lg_code,
                    forecast_summary.district_lg_code ?? district_lg_code,
                    forecast_summary.block_lg_code ?? block_lg_code ?? null,
                    forecast_summary.summary_en ?? null,
                    forecast_summary.summary_hi ?? null,
                ]
            );
        }

        // 9. Save bilingual advisories
        if (Array.isArray(advisories) && advisories.length > 0) {
            for (const advisory of advisories) {
                // Insert English first
                const [englishResult] = await connection.execute(
                    `INSERT INTO imd_advisory_detail (
            advisory_main_id,
            advisory_detail_id,
            cat_id,
            crop_id,
            crop_stage_id,
            advisory_type_id,
            advisory,
            language_Id,
            block_lg_code,
            district_lg_code,
            state_lg_code
          ) VALUES (?, NULL, ?, ?, ?, ?, ?, 2, ?, ?, ?)`,
                    [
                        advisory_main_id,
                        advisory.imd_category_id,
                        advisory.crop_id ?? null,
                        advisory.crop_stage_id ?? null,
                        advisory.imd_advisory_type_id,
                        advisory.advisory_en ?? null,
                        advisory.block_lg_code ?? block_lg_code ?? null,
                        advisory.district_lg_code ?? district_lg_code,
                        advisory.state_lg_code ?? state_lg_code,
                    ]
                );

                const english_advisory_id = englishResult.insertId;

                // English row references its own ID
                await connection.execute(
                    `UPDATE imd_advisory_detail
           SET advisory_detail_id = ?
           WHERE id = ?`,
                    [english_advisory_id, english_advisory_id]
                );

                // Insert Hindi with the same advisory_detail_id
                await connection.execute(
                    `INSERT INTO imd_advisory_detail (
            advisory_main_id,
            advisory_detail_id,
            cat_id,
            crop_id,
            crop_stage_id,
            advisory_type_id,
            advisory,
            language_Id,
            block_lg_code,
            district_lg_code,
            state_lg_code
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
                    [
                        advisory_main_id,
                        english_advisory_id,
                        advisory.imd_category_id,
                        advisory.crop_id ?? null,
                        advisory.crop_stage_id ?? null,
                        advisory.imd_advisory_type_id,
                        advisory.advisory_hi ?? null,
                        advisory.block_lg_code ?? block_lg_code ?? null,
                        advisory.district_lg_code ?? district_lg_code,
                        advisory.state_lg_code ?? state_lg_code,
                    ]
                );
            }
        }

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: "Weather advisory bulletin submitted successfully.",
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("Error submitting advisory wizard:", error);

        return res.status(500).json({
            success: false,
            message:
                error.message || "Failed to submit weather advisory bulletin.",
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};