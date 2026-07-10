import { pool } from "../config/db.js";

export const getRoles = async (req, res) => {
    try {

        const [rows] = await pool.query(`
            SELECT
                id,
                name,
                description
            FROM roles
            ORDER BY name ASC
        `);

        return res.status(200).json({
            success: true,
            data: rows,
            count: rows.length
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch roles."
        });

    }
};

export const createRole = async (req, res) => {
    try {

        const {
            name,
            description
        } = req.body;

        if (!name?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Role name is required."
            });
        }

        const [[existing]] = await pool.query(
            `
            SELECT id
            FROM roles
            WHERE name = ?
            `,
            [name.trim()]
        );

        if (existing) {
            return res.status(409).json({
                success: false,
                message: "Role already exists."
            });
        }

        const [result] = await pool.query(
            `
  INSERT INTO roles
  (
      name,
      description
  )
  VALUES (?, ?)
  `,
            [
                name.trim(),
                description?.trim() || null
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Role created successfully.",
            data: {
                id: result.insertId
            }
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to create role."
        });

    }
};

export const updateRole = async (req, res) => {
    try {

        const { id } = req.params;

        const {
            name,
            description
        } = req.body;

        if (!name?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Role name is required."
            });
        }

        const [[role]] = await pool.query(
            `
            SELECT id
            FROM roles
            WHERE id = ?
            `,
            [id]
        );

        if (!role) {
            return res.status(404).json({
                success: false,
                message: "Role not found."
            });
        }

        const [[existing]] = await pool.query(
            `
            SELECT id
            FROM roles
            WHERE name = ?
              AND id <> ?
            `,
            [
                name.trim(),
                id
            ]
        );

        if (existing) {
            return res.status(409).json({
                success: false,
                message: "Role already exists."
            });
        }

        await pool.query(
            `
            UPDATE roles
            SET
                name = ?,
                description = ?
            WHERE id = ?
            `,
            [
                name.trim(),
                description?.trim() || null,
                id
            ]
        );

        return res.status(200).json({
            success: true,
            message: "Role updated successfully."
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to update role."
        });

    }
};

export const deleteRole = async (req, res) => {
    try {

        const { id } = req.params;

        const [[role]] = await pool.query(
            `
            SELECT id
            FROM roles
            WHERE id = ?
            `,
            [id]
        );

        if (!role) {
            return res.status(404).json({
                success: false,
                message: "Role not found."
            });
        }

        const [[usage]] = await pool.query(
            `
            SELECT COUNT(*) AS total
            FROM user_roles
            WHERE role_id = ?
            `,
            [id]
        );

        if (usage.total > 0) {
            return res.status(409).json({
                success: false,
                message: "Cannot delete role because it is assigned to one or more users."
            });
        }

        await pool.query(
            `
            DELETE FROM roles
            WHERE id = ?
            `,
            [id]
        );

        return res.status(200).json({
            success: true,
            message: "Role deleted successfully."
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete role."
        });

    }
};

export const getRolePermissions = async (req, res) => {
    try {

        const { id } = req.params;

        const [[role]] = await pool.query(
            `
            SELECT
                id,
                name,
                description
            FROM roles
            WHERE id = ?
            `,
            [id]
        );

        if (!role) {
            return res.status(404).json({
                success: false,
                message: "Role not found."
            });
        }

        const [permissions] = await pool.query(
            `
            SELECT
                permission_id
            FROM role_permissions
            WHERE role_id = ?
            ORDER BY permission_id
            `,
            [id]
        );

        return res.status(200).json({
            success: true,
            data: {
                role,
                permissionIds: permissions.map(
                    permission => permission.permission_id
                )
            }
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch role permissions."
        });

    }
};

export const updateRolePermissions = async (req, res) => {

    const connection = await pool.getConnection();

    try {

        const { id } = req.params;

        const { permissionIds = [] } = req.body;

        const [[role]] = await connection.query(
            `
            SELECT id
            FROM roles
            WHERE id = ?
            `,
            [id]
        );

        if (!role) {

            connection.release();

            return res.status(404).json({
                success: false,
                message: "Role not found."
            });

        }

        const [validPermissions] = await connection.query(
            `
    SELECT id
    FROM permissions
    WHERE id IN (?)
    `,
            [permissionIds]
        );

        if (validPermissions.length !== permissionIds.length) {

            connection.release();

            return res.status(400).json({
                success: false,
                message: "One or more permission IDs are invalid."
            });

        }

        await connection.beginTransaction();

        await connection.query(
            `
            DELETE
            FROM role_permissions
            WHERE role_id = ?
            `,
            [id]
        );

        if (permissionIds.length > 0) {

            const values = permissionIds.map(permissionId => [
                id,
                permissionId
            ]);

            await connection.query(
                `
                INSERT INTO role_permissions
                (
                    role_id,
                    permission_id
                )
                VALUES ?
                `,
                [values]
            );

        }

        await connection.commit();

        connection.release();

        return res.status(200).json({
            success: true,
            message: "Role permissions updated successfully."
        });

    } catch (error) {

        await connection.rollback();

        connection.release();

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to update role permissions."
        });

    }

};