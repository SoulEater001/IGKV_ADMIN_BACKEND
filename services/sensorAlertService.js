export const executeCreateSensorAlert = async (
    connection,
    data
) => {

    const [[existing]] = await connection.query(
        `
        SELECT id
        FROM sensor_alert
        WHERE crop_id = ?
          AND stage_id = ?
          AND sensor_key = ?
          AND sensor_status = ?
        `,
        [
            data.crop_id,
            data.stage_id,
            data.sensor_key,
            data.sensor_status
        ]
    );

    if (existing) {
        throw new Error("Sensor alert already exists.");
    }

    const [result] = await connection.query(
        `
        INSERT INTO sensor_alert
        (
            crop_id,
            stage_id,
            sensor_key,
            sensor_status,
            sensor_alert_text,
            sensor_alert_text_h
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
            data.crop_id,
            data.stage_id,
            data.sensor_key,
            data.sensor_status,
            data.sensor_alert_text,
            data.sensor_alert_text_h
        ]
    );

    return result.insertId;
};

export const executeUpdateSensorAlert = async (
    connection,
    data
) => {

    const {
        id,
        crop_id,
        stage_id,
        sensor_key,
        sensor_status,
        sensor_alert_text,
        sensor_alert_text_h
    } = data;

    await connection.query(
        `
        UPDATE sensor_alert
        SET
            crop_id = ?,
            stage_id = ?,
            sensor_key = ?,
            sensor_status = ?,
            sensor_alert_text = ?,
            sensor_alert_text_h = ?
        WHERE id = ?
        `,
        [
            crop_id,
            stage_id,
            sensor_key.trim(),
            sensor_status,
            sensor_alert_text?.trim() || null,
            sensor_alert_text_h?.trim() || null,
            id
        ]
    );

    return id;
};

export const executeDeleteSensorAlert = async (
    connection,
    sensorAlertId
) => {

    const [result] = await connection.query(
        `
        DELETE FROM sensor_alert
        WHERE id = ?
        `,
        [sensorAlertId]
    );

    if (!result.affectedRows) {
        throw new Error("Sensor alert not found.");
    }

    return sensorAlertId;
};