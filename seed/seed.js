import "dotenv/config";
import bcrypt from "bcrypt";
import { pool } from "../config/db.js";
import { PERMISSION_ACTION_LIST, PERMISSION_RESOURCE_LIST, ROLES } from "../constant/index.js";


const RESOURCES = PERMISSION_RESOURCE_LIST;

const ACTIONS = PERMISSION_ACTION_LIST;

const PERMISSIONS = RESOURCES.flatMap(resource =>
    ACTIONS.map(action => ({ resource, action }))
);

if (
    !process.env.SUPER_ADMIN_EMAIL ||
    !process.env.SUPER_ADMIN_PASSWORD ||
    !process.env.SUPER_ADMIN_NAME
) {
    throw new Error(
        "Missing SUPER_ADMIN environment variables."
    );
}

async function seedRoles() {
    console.log("Seeding roles...");

    for (const role of Object.values(ROLES)) {
        await pool.query(
            `
            INSERT IGNORE INTO roles (name, description)
            VALUES (?, ?)
            `,
            [role.name, role.description]
        );
    }

    console.log("✓ Roles seeded");
}

async function seedPermissions() {
    console.log("Seeding permissions...");

    for (const permission of PERMISSIONS) {
        await pool.query(
            `
            INSERT IGNORE INTO permissions (resource, action)
            VALUES (?, ?)
            `,
            [permission.resource, permission.action]
        );
    }

    console.log("✓ Permissions seeded");
}

async function seedSuperAdmin() {
    console.log("Checking super admin...");

    const email = process.env.SUPER_ADMIN_EMAIL;
    const password = process.env.SUPER_ADMIN_PASSWORD;
    const name = process.env.SUPER_ADMIN_NAME;

    const [existing] = await pool.query(
        "SELECT id FROM admin_users WHERE email = ?",
        [email]
    );

    if (existing.length) {
        console.log("✓ Super Admin already exists");
        return existing[0].id;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
        `
        INSERT INTO admin_users
        (name, email, password)
        VALUES (?, ?, ?)
        `,
        [name, email, hashedPassword]
    );

    console.log("✓ Super Admin created");

    return result.insertId;
}

async function assignSuperAdminRole(userId) {
    console.log("Assigning SUPER_ADMIN role...");

    await pool.query(
        `
        INSERT IGNORE INTO user_roles (user_id, role_id)

        SELECT ?, id

        FROM roles

        WHERE name = 'SUPER_ADMIN'
        `,
        [userId]
    );

    console.log("✓ Role assigned");
}

async function assignSuperAdminPermissions() {
    console.log("Assigning permissions...");

    await pool.query(
        `
        INSERT IGNORE INTO role_permissions (role_id, permission_id)

        SELECT
            r.id,
            p.id

        FROM roles r

        CROSS JOIN permissions p

        WHERE r.name = 'SUPER_ADMIN'
        `
    );

    console.log("✓ Permissions assigned");
}

async function seed() {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        console.log("\n========== SEED STARTED ==========\n");

        await seedRoles();

        await seedPermissions();

        const userId = await seedSuperAdmin();

        await assignSuperAdminRole(userId);

        await assignSuperAdminPermissions();

        console.log("\n========== SEED COMPLETED ==========\n");
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        console.error("Seeding failed:");
        console.error(error);

    } finally {

        connection.release();

    }
}

seed();