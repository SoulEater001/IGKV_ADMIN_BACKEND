import { pool } from "../config/db.js";

export const getAdvisories = async (req, res) => {
    try {
        const {
            stateLgCode,
            districtLgCode,
            blockLgCode,
            languageId,
            page = 1,
            limit = 10,
        } = req.query;

        if (!stateLgCode || !districtLgCode || !blockLgCode || !languageId) {
            return res.status(400).json({
                success: false,
                message: "stateLgCode, districtLgCode, blockLgCode and languageId are required.",
            });
        }

        const pageNumber = Number(page);
        const pageSize = Number(limit);
        const offset = (pageNumber - 1) * pageSize;

        // Total records
        const [[countResult]] = await pool.query(
            `
            SELECT COUNT(*) AS total
            FROM imd_advisory_detail
            WHERE state_lg_code = ?
              AND district_lg_code = ?
              AND block_lg_code = ?
              AND language_id = ?
            `,
            [stateLgCode, districtLgCode, blockLgCode, languageId]
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

                at.imd_advisory_type_id,
                at.imd_advisory_type_name AS advisory_type,

                m.advisory_date,
                m.create_datetime

            FROM imd_advisory_detail d

            JOIN imd_advisory_main m
                ON d.advisory_main_id = m.id

            LEFT JOIN imd_m_category c
                ON d.cat_id = c.imd_category_id

            LEFT JOIN imd_advisory_type at
                ON d.advisory_type_id = at.imd_advisory_type_id

            WHERE d.state_lg_code = ?
              AND d.district_lg_code = ?
              AND d.block_lg_code = ?
              AND d.language_id = ?

            ORDER BY m.advisory_date DESC, d.id DESC

            LIMIT ?
            OFFSET ?
            `,
            [
                stateLgCode,
                districtLgCode,
                blockLgCode,
                languageId,
                pageSize,
                offset,
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

export const getAdvisoryTypes = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                id,
                imd_advisory_type_id,
                imd_advisory_type_name,
                imd_advisory_type_name_h
            FROM imd_advisory_type
            ORDER BY id ASC
        `);

        res.json({
            success: true,
            data: rows,
            count: rows.length
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch advisory types."
        });

    }
};

export const createAdvisoryType = async (req, res) => {
    try {
        const {
            imd_advisory_type_name,
            imd_advisory_type_name_h
        } = req.body;

        if (!imd_advisory_type_name?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Advisory type name is required."
            });
        }

        const [result] = await pool.query(
            `
            INSERT INTO imd_advisory_type
            (
                imd_advisory_type_name,
                imd_advisory_type_name_h
            )
            VALUES (?, ?)
            `,
            [
                imd_advisory_type_name.trim(),
                imd_advisory_type_name_h?.trim() || null
            ]
        );

        const advisoryTypeId = result.insertId;

        await pool.query(
            `
            UPDATE imd_advisory_type
            SET imd_advisory_type_id = ?
            WHERE id = ?
            `,
            [advisoryTypeId, advisoryTypeId]
        );

        return res.status(201).json({
            success: true,
            message: "Advisory type created successfully.",
            data: {
                id: advisoryTypeId,
                imd_advisory_type_id: advisoryTypeId
            }
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to create advisory type."
        });

    }
};

export const updateAdvisoryType = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            imd_advisory_type_name,
            imd_advisory_type_name_h
        } = req.body;

        if (!imd_advisory_type_name?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Advisory type name is required."
            });
        }

        const [result] = await pool.query(
            `
            UPDATE imd_advisory_type
            SET
                imd_advisory_type_name = ?,
                imd_advisory_type_name_h = ?
            WHERE id = ?
            `,
            [
                imd_advisory_type_name.trim(),
                imd_advisory_type_name_h?.trim() || null,
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Advisory type not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Advisory type updated successfully."
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to update advisory type."
        });

    }
};

export const deleteAdvisoryType = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if advisory type exists
        const [typeRows] = await pool.query(
            `
            SELECT id
            FROM imd_advisory_type
            WHERE id = ?
            `,
            [id]
        );

        if (typeRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Advisory type not found."
            });
        }

        // Check if it is being used
        const [[usage]] = await pool.query(
            `
            SELECT COUNT(*) AS total
            FROM imd_advisory_detail
            WHERE advisory_type_id = ?
            `,
            [id]
        );

        if (usage.total > 0) {
            return res.status(409).json({
                success: false,
                message: "Cannot delete advisory type because it is used by existing advisories."
            });
        }

        // Safe to delete
        await pool.query(
            `
            DELETE FROM imd_advisory_type
            WHERE id = ?
            `,
            [id]
        );

        return res.status(200).json({
            success: true,
            message: "Advisory type deleted successfully."
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete advisory type."
        });
    }
};

export const updateAdvisory = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            state_lg_code,
            district_lg_code,
            block_lg_code,
            imd_category_id,
            imd_advisory_type_id,
            advisory,
            language_id
        } = req.body;

        if (
            state_lg_code == null ||
            district_lg_code == null ||
            block_lg_code == null ||
            advisory == null ||
            advisory.trim() === "" ||
            language_id == null
        ) {
            return res.status(400).json({
                success: false,
                message: "All fields are required."
            });
        }

        const [existing] = await pool.query(
            `
            SELECT id
            FROM imd_advisory_detail
            WHERE id = ?
            `,
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Advisory not found."
            });
        }

        await pool.query(
            `
            UPDATE imd_advisory_detail
            SET
                state_lg_code = ?,
                district_lg_code = ?,
                block_lg_code = ?,
                cat_id = ?,
                advisory_type_id = ?,
                advisory = ?,
                language_id = ?
            WHERE id = ?
            `,
            [
                state_lg_code,
                district_lg_code,
                block_lg_code,
                imd_category_id,
                imd_advisory_type_id,
                advisory.trim(),
                language_id,
                id
            ]
        );

        res.json({
            success: true,
            message: "Advisory updated successfully."
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to update advisory."
        });

    }
};

export const createAdvisory = async (req, res) => {
    try {
        const {
            state_lg_code,
            district_lg_code,
            block_lg_code,
            imd_category_id,
            imd_advisory_type_id,
            language_id,
            advisory,
            advisory_date
        } = req.body;
        console.log(req.body)

        if (
            state_lg_code == null ||
            district_lg_code == null ||
            block_lg_code == null ||
            language_id == null ||
            advisory == null ||
            advisory_date == null ||
            advisory.trim() === ""
        ) {
            return res.status(400).json({
                success: false,
                message: "Please fill all required fields."
            });
        }

        //
        // Find today's advisory_main row.
        // If none exists, create one.
        //
        const advisoryDate = advisory_date;

        const [mainRows] = await pool.query(
            `
      SELECT id
      FROM imd_advisory_main
      WHERE DATE(advisory_date) = ?
      LIMIT 1
      `,
            [advisoryDate]
        );

        let advisoryMainId;

        if (mainRows.length > 0) {
            advisoryMainId = mainRows[0].id;
        } else {
            const [result] = await pool.query(
                `
        INSERT INTO imd_advisory_main
        (
          advisory_date,
          create_datetime
        )
        VALUES (?, NOW())
        `,
                [advisoryDate]
            );

            advisoryMainId = result.insertId;
            await pool.query(
                `
    UPDATE imd_advisory_main
    SET advisory_main_id = ?
    WHERE id = ?
    `,
                [advisoryMainId, advisoryMainId]
            );
        }

        await pool.query(
            `
      INSERT INTO imd_advisory_detail
      (
        advisory_main_id,
        state_lg_code,
        district_lg_code,
        block_lg_code,
        cat_id,
        advisory_type_id,
        advisory,
        language_id
      )
      VALUES
      (
        ?, ?, ?, ?, ?, ?, ?, ?
      )
      `,
            [
                advisoryMainId,
                state_lg_code,
                district_lg_code,
                block_lg_code,
                imd_category_id,
                imd_advisory_type_id,
                advisory.trim(),
                language_id
            ]
        );

        res.status(201).json({
            success: true,
            message: "Advisory created successfully."
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to create advisory."
        });
    }
};