import { pool } from "../config/db.js";

export async function logActivity({
    userId,
    action,
    entity,
    entityId = null,
    description,
    ipAddress = null
}) {

     try {
        await pool.query(
            `
            INSERT INTO activity_log
            (
                user_id,
                action,
                entity,
                entity_id,
                description,
                ip_address
            )
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                userId,
                action,
                entity,
                entityId,
                description,
                ipAddress
            ]
        );
    } catch (error) {
        console.error("Activity logger failed:", error);
    }

}