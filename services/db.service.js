// services/db.service.js
import { digitalAgriPool } from "../config/digitalAgriDb.js";

async function saveSensorData(deviceId, data) {
  const ts = new Date();
  const rows = [];

  for (const key in data) {
    rows.push([deviceId, key, data[key], ts]);
  }

  if (rows.length === 0) return true;

  const placeholders = rows.map(() => "(?,?,?,?)").join(",");
  const values = rows.flat();

  await digitalAgriPool.query(
    `INSERT INTO iot_sensor_readings (deviceId, sensorKey, sensorValue, ts)
     VALUES ${placeholders}`,
    values
  );

  return true;
}

// UPDATE DEVICE STATUS (LWT or online event)
async function updateDeviceStatus(deviceId, status) {
  await digitalAgriPool.query(
    `UPDATE iot_devices
     SET status = ?, lastHeartbeat = NULL
     WHERE deviceId = ?`,
    [status, deviceId]
  );
}

// UPDATE LAST HEARTBEAT (each heartbeat/event)
async function updateHeartbeat(deviceId) {
  await digitalAgriPool.query(
    `UPDATE iot_devices
     SET lastHeartbeat = NOW(), status = 'online'
     WHERE deviceId = ?`,
    [deviceId]
  );
}

// UPDATE DEVICE GPS (event-based, not telemetry)
async function updateDeviceGps(deviceId, lat, lng) {
  await digitalAgriPool.query(
    `
    UPDATE iot_devices
    SET latitude = ?,
        longitude = ?,
        last_gps_updated = NOW()
    WHERE deviceId = ?
    `,
    [lat, lng, deviceId]
  );
}

// UPDATE DEVICE INTERVAL
async function updateDeviceInterval(deviceId, intervalMs) {
  await digitalAgriPool.query(
    `
    UPDATE iot_devices
    SET interval_ms = ?
    WHERE deviceId = ?
    `,
    [intervalMs, deviceId]
  );

  return true;
}

// GET USER (mobileNo) BY DEVICE ID
async function getUserByDeviceId(deviceId) {
  const [rows] = await digitalAgriPool.query(
    `
    SELECT mobileNo
    FROM iot_devices
    WHERE deviceId = ?
    `,
    [deviceId]
  );

  return rows.length ? rows[0].mobileNo : null;
}

// GET ALL FCM TOKENS FOR A USER
async function getFcmTokensByUser(mobileNo) {
  const [rows] = await digitalAgriPool.query(
    `
    SELECT fcm_token
    FROM fcm_tokens
    WHERE user_id = ?
    `,
    [mobileNo]
  );

  return rows.map((r) => r.fcm_token);
}

async function getUserAndDeviceNameByDeviceId(deviceId) {
  const [rows] = await digitalAgriPool.query(
    `
    SELECT
      d.deviceName,
      d.mobileNo
    FROM iot_devices d
    WHERE d.deviceId = ?
    `,
    [deviceId]
  );

  if (rows.length === 0) return null;

  return {
    mobileNo: rows[0].mobileNo,
    deviceName: rows[0].deviceName,
  };
}

async function storeNotification({
  deviceId,
  deviceName,
  mobileNo,
  type,
  title,
  message,
}) {
  await digitalAgriPool.query(
    `
    INSERT INTO iot_notifications
    (deviceId, deviceName, mobileNo, type, title, message)
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [deviceId, deviceName, mobileNo, type, title, message]
  );
}

export {
  saveSensorData,
  updateDeviceStatus,
  updateHeartbeat,
  updateDeviceGps,
  updateDeviceInterval,
  getUserByDeviceId,
  getFcmTokensByUser,
  getUserAndDeviceNameByDeviceId,
  storeNotification,
};