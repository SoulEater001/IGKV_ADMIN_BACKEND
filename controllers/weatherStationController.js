import { pool } from "../config/db.js";

export const getWeatherStations = async (req, res) => {
    try {
        const { is_active } = req.query;

        const conditions = [];
        const params = [];

        if (is_active !== undefined) {
            conditions.push("ws.is_active = ?");
            params.push(is_active === "true" ? 1 : 0);
        }

        const whereClause = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        const [rows] = await pool.query(`
            SELECT
                ws.id,
                ws.station_name,
                ws.station_name_h,
                ws.station_code,
                ws.state_lg_code,
                ws.district_lg_code,
                ws.block_lg_code,
                ws.is_active,

                s.name AS state_name,
                sl.name AS state_name_h,

                d.name AS district_name,
                dl.name AS district_name_h,

                b.name AS block_name,
                bl.name AS block_name_h

            FROM weather_station ws

            LEFT JOIN m_state s
                ON s.state_lg_code = ws.state_lg_code

            LEFT JOIN m_state_language sl
                ON sl.state_id = s.state_id
                AND sl.language_id = 1

            LEFT JOIN m_district d
                ON d.district_lg_code = ws.district_lg_code

            LEFT JOIN m_district_language dl
                ON dl.district_id = d.district_id
                AND dl.language_id = 1

            LEFT JOIN m_block b
                ON b.block_lg_code = ws.block_lg_code

            LEFT JOIN m_block_language bl
                ON bl.block_id = b.block_id
                AND bl.language_id = 1

            ${whereClause}

            ORDER BY ws.station_name ASC
        `, params);

        return res.status(200).json({
            success: true,
            message: "Weather stations fetched successfully",
            data: rows
        });

    } catch (error) {
        console.error("Failed to fetch weather stations:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch weather stations",
            data: []
        });
    }
};

export const getWeatherStationsPaginated = async (req, res) => {
    try {
        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.min(
            Math.max(Number(req.query.limit) || 10, 1),
            100
        );

        const offset = (page - 1) * limit;

        const search = String(req.query.search || '').trim();

        const stateLgCode = req.query.state_lg_code
            ? Number(req.query.state_lg_code)
            : null;

        const districtLgCode = req.query.district_lg_code
            ? Number(req.query.district_lg_code)
            : null;

        const blockLgCode = req.query.block_lg_code
            ? Number(req.query.block_lg_code)
            : null;

        const isActive =
            req.query.is_active !== undefined &&
                req.query.is_active !== ''
                ? Number(req.query.is_active)
                : null;

        const where = [];
        const params = [];

        // -----------------------------
        // Search
        // -----------------------------

        if (search) {
            where.push(`
        (
            ws.station_name LIKE ?
            OR ws.station_name_h LIKE ?
            OR ws.station_code LIKE ?

            OR s.name LIKE ?
            OR sl.name LIKE ?

            OR d.name LIKE ?
            OR dl.name LIKE ?

            OR b.name LIKE ?
            OR bl.name LIKE ?
        )
    `);

            const searchValue = `%${search}%`;

            params.push(
                searchValue,
                searchValue,
                searchValue,
                searchValue,
                searchValue,
                searchValue,
                searchValue,
                searchValue,
                searchValue
            );
        }

        // -----------------------------
        // Location filters
        // -----------------------------

        if (stateLgCode) {
            where.push(`ws.state_lg_code = ?`);
            params.push(stateLgCode);
        }

        if (districtLgCode) {
            where.push(`ws.district_lg_code = ?`);
            params.push(districtLgCode);
        }

        if (blockLgCode) {
            where.push(`ws.block_lg_code = ?`);
            params.push(blockLgCode);
        }

        // -----------------------------
        // Active / inactive
        // -----------------------------

        if (isActive !== null) {
            where.push(`ws.is_active = ?`);
            params.push(isActive);
        }

        const whereClause = where.length
            ? `WHERE ${where.join(' AND ')}`
            : '';

        // -----------------------------
        // Total count
        // -----------------------------

        const [countRows] = await pool.query(
            `
    SELECT COUNT(*) AS total
    FROM weather_station ws

    LEFT JOIN m_state s
        ON s.state_lg_code = ws.state_lg_code

    LEFT JOIN m_state_language sl
        ON sl.state_id = s.state_id
        AND sl.language_id = 1

    LEFT JOIN m_district d
        ON d.district_lg_code = ws.district_lg_code

    LEFT JOIN m_district_language dl
        ON dl.district_id = d.district_id
        AND dl.language_id = 1

    LEFT JOIN m_block b
        ON b.block_lg_code = ws.block_lg_code

    LEFT JOIN m_block_language bl
        ON bl.block_id = b.block_id
        AND bl.language_id = 1

    ${whereClause}
    `,
            params
        );

        const total = Number(countRows[0]?.total || 0);

        // -----------------------------
        // Data
        // -----------------------------

        const [rows] = await pool.query(
            `
    SELECT
        ws.id,
        ws.station_name,
        ws.station_name_h,
        ws.station_code,
        ws.state_lg_code,
        ws.district_lg_code,
        ws.block_lg_code,
        ws.is_active,

        s.name AS state_name,
        sl.name AS state_name_h,

        d.name AS district_name,
        dl.name AS district_name_h,

        b.name AS block_name,
        bl.name AS block_name_h

    FROM weather_station ws

    LEFT JOIN m_state s
        ON s.state_lg_code = ws.state_lg_code

    LEFT JOIN m_state_language sl
        ON sl.state_id = s.state_id
        AND sl.language_id = 1

    LEFT JOIN m_district d
        ON d.district_lg_code = ws.district_lg_code

    LEFT JOIN m_district_language dl
        ON dl.district_id = d.district_id
        AND dl.language_id = 1

    LEFT JOIN m_block b
        ON b.block_lg_code = ws.block_lg_code

    LEFT JOIN m_block_language bl
        ON bl.block_id = b.block_id
        AND bl.language_id = 1

    ${whereClause}

    ORDER BY ws.station_name ASC

    LIMIT ? OFFSET ?
    `,
            [...params, limit, offset]
        );

        return res.status(200).json({
            success: true,
            message: "Weather stations fetched successfully",
            data: rows,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            search
        });

    } catch (error) {
        console.error("Failed to fetch weather stations:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch weather stations",
            data: [],
            total: 0,
            page: 1,
            limit: 10,
            totalPages: 0,
            search: ''
        });
    }
};

export const createWeatherStation = async (req, res) => {
    try {
        const {
            station_name,
            station_name_h,
            station_code,
            state_lg_code,
            district_lg_code,
            block_lg_code
        } = req.body;

        // -----------------------------
        // Validation
        // -----------------------------

        if (!station_name?.trim() && !station_name_h?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Station name is required"
            });
        }

        if (!state_lg_code) {
            return res.status(400).json({
                success: false,
                message: "State is required"
            });
        }

        // -----------------------------
        // Check duplicate station code
        // -----------------------------

        if (station_code?.trim()) {
            const [existing] = await pool.query(
                `
                SELECT id
                FROM weather_station
                WHERE station_code = ?
                LIMIT 1
                `,
                [station_code.trim()]
            );

            if (existing.length) {
                return res.status(409).json({
                    success: false,
                    message: "Station code already exists"
                });
            }
        }

        // -----------------------------
        // Insert
        // -----------------------------

        const [result] = await pool.query(
            `
            INSERT INTO weather_station (
                station_name,
                station_name_h,
                station_code,
                state_lg_code,
                district_lg_code,
                block_lg_code
            )
            VALUES (?, ?, ?, ?, ?)
            `,
            [
                station_name.trim(),
                station_name_h.trim(),
                station_code?.trim() || null,
                state_lg_code,
                district_lg_code ?? null,
                block_lg_code ?? null
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Weather station created successfully",
            data: {
                id: result.insertId
            },
            approvalRequired: false
        });

    } catch (error) {
        console.error("Failed to create weather station:", error);

        // Duplicate-key safety net
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "Station code already exists"
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to create weather station"
        });
    }
};

export const updateWeatherStation = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            station_name,
            station_name_h,
            station_code,
            state_lg_code,
            district_lg_code,
            block_lg_code
        } = req.body;

        // -----------------------------
        // Validate ID
        // -----------------------------

        if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid station ID"
            });
        }

        // -----------------------------
        // Validation
        // -----------------------------

        if (!station_name?.trim() && !station_name_h?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Station name is required"
            });
        }

        if (!state_lg_code) {
            return res.status(400).json({
                success: false,
                message: "State is required"
            });
        }

        // -----------------------------
        // Check station exists
        // -----------------------------

        const [existingStation] = await pool.query(
            `
            SELECT id
            FROM weather_station
            WHERE id = ?
            LIMIT 1
            `,
            [id]
        );

        if (!existingStation.length) {
            return res.status(404).json({
                success: false,
                message: "Weather station not found"
            });
        }

        // -----------------------------
        // Check duplicate station code
        // -----------------------------

        if (station_code?.trim()) {
            const [duplicate] = await pool.query(
                `
                SELECT id
                FROM weather_station
                WHERE station_code = ?
                  AND id <> ?
                LIMIT 1
                `,
                [
                    station_code.trim(),
                    id
                ]
            );

            if (duplicate.length) {
                return res.status(409).json({
                    success: false,
                    message: "Station code already exists"
                });
            }
        }

        // -----------------------------
        // Update
        // -----------------------------

        const [result] = await pool.query(
            `
            UPDATE weather_station
            SET
                station_name = ?,
                station_name_h = ?,
                station_code = ?,
                state_lg_code = ?,
                district_lg_code = ?,
                block_lg_code = ?
            WHERE id = ?
            `,
            [
                station_name.trim(),
                station_name_h.trim(),
                station_code?.trim() || null,
                state_lg_code,
                district_lg_code ?? null,
                block_lg_code ?? null,
                id
            ]
        );

        return res.status(200).json({
            success: true,
            message: "Weather station updated successfully",
            data: {
                id: Number(id)
            },
            approvalRequired: false
        });

    } catch (error) {
        console.error("Failed to update weather station:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "Station code already exists"
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to update weather station"
        });
    }
};

export const deleteWeatherStation = async (req, res) => {
    try {
        const { id } = req.params;

        if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid station ID"
            });
        }

        const [result] = await pool.query(
            `
            UPDATE weather_station
            SET is_active = 0
            WHERE id = ?
              AND is_active = 1
            `,
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Active weather station not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Weather station deactivated successfully",
            data: {
                id: Number(id)
            },
            approvalRequired: false
        });

    } catch (error) {
        console.error("Failed to deactivate weather station:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to deactivate weather station"
        });
    }
};

export const activateWeatherStation = async (req, res) => {
    try {
        const { id } = req.params;

        if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid station ID"
            });
        }

        const [result] = await pool.query(
            `
            UPDATE weather_station
            SET is_active = 1
            WHERE id = ?
              AND is_active = 0
            `,
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Inactive weather station not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Weather station activated successfully",
            data: {
                id: Number(id)
            }
        });

    } catch (error) {
        console.error("Failed to activate weather station:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to activate weather station"
        });
    }
};
