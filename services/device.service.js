import { digitalAgriPool } from "../config/digitalAgriDb.js";
import {
  DeviceDTO,
  SensorHistoryDTO,
  DeviceSummaryDTO,
  ReadyDeviceDTO,
  DeviceDashboardDTO
} from "../models/device.dto.js";

async function createDevice(body) {
  const {
    deviceId,
    deviceName = null,
    userName = null,
    deviceType= null,
    mobileNo = null,
    firmwareVersion = null,
    connectionType = null,
  } = body;

  const query = `
    INSERT INTO iot_devices
      (deviceId, deviceName, userName, mobileNo, deviceType, firmwareVersion)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  await digitalAgriPool.query(query, [
    deviceId,
    deviceName,
    userName,
    mobileNo,
    deviceType,
    firmwareVersion
  ]);

  return {
    deviceId,
    deviceName,
    deviceType,
    userName, 
    mobileNo,
    firmwareVersion,
    // connectionType,
  };
}

async function getAllDevices() {
  const [rows] = await digitalAgriPool.query(
    "SELECT * FROM iot_devices"
  );

  return rows.map((row) => new DeviceDTO(row));
}

async function getDeviceById(deviceId) {
  const [rows] = await digitalAgriPool.query(
    "SELECT * FROM iot_devices WHERE deviceId = ?",
    [deviceId]
  );

  if (!rows.length) {
    throw new Error("Device not found");
  }

  return new DeviceDTO(rows[0]);
}

async function getDevicesByMobileNo(mobileNo) {
  const [rows] = await digitalAgriPool.query(
    `
      SELECT *
      FROM iot_devices
      WHERE mobileNo = ?
      ORDER BY registeredAt DESC
    `,
    [mobileNo]
  );

  return rows.map((row) => new DeviceDTO(row));
}

async function updateDevice(deviceId, body) {
  if (
    ("latitude" in body && body.latitude === null) ||
    ("longitude" in body && body.longitude === null)
  ) {
    throw new Error("Invalid GPS update");
  }

  const fields = [];
  const values = [];

  for (const key in body) {
    fields.push(`${key} = ?`);
    values.push(body[key]);
  }

  values.push(deviceId);

  const query = `
    UPDATE iot_devices
    SET ${fields.join(", ")}
    WHERE deviceId = ?
  `;

  await digitalAgriPool.query(query, values);

  return { deviceId };
}

async function deleteDevice(deviceId) {
  await digitalAgriPool.query(
    "DELETE FROM iot_devices WHERE deviceId = ?",
    [deviceId]
  );
}

async function assignDeviceToUser(deviceId, mobileNo) {
  // Fetch user
  const [userRows] = await digitalAgriPool.query(
    `SELECT userName FROM iot_users WHERE mobileNo = ?`,
    [mobileNo]
  );

  if (!userRows.length) {
    throw new Error("User not found");
  }

  const { userName } = userRows[0];

  // Fetch device
  const [deviceRows] = await digitalAgriPool.query(
    `SELECT mobileNo FROM iot_devices WHERE deviceId = ?`,
    [deviceId]
  );

  if (!deviceRows.length) {
    throw new Error("Device not found");
  }

  const { mobileNo: currentMobile } = deviceRows[0];

  if (currentMobile === mobileNo) {
    throw new Error("Device already assigned to this account");
  }

  if (currentMobile && currentMobile !== mobileNo) {
    throw new Error("Device is already assigned to another user");
  }

  await digitalAgriPool.query(
    `
      UPDATE iot_devices
      SET userName = ?, mobileNo = ?
      WHERE deviceId = ?
    `,
    [userName, mobileNo, deviceId]
  );

  return {
    deviceId,
    userName,
    mobileNo,
    message: "Device successfully assigned",
  };
}

async function getDashboardSummary() {
  const [[{ c: totalDevices }]] = await digitalAgriPool.query(
    "SELECT COUNT(*) AS c FROM iot_devices"
  );

  const [[{ c: totalUsers }]] = await digitalAgriPool.query(
    "SELECT COUNT(*) AS c FROM iot_users"
  );

  const [[{ c: assignedDevices }]] = await digitalAgriPool.query(
    "SELECT COUNT(*) AS c FROM iot_devices WHERE mobileNo IS NOT NULL"
  );

  const unassignedDevices = totalDevices - assignedDevices;

  return new DeviceDashboardDTO({
    totalDevices,
    totalUsers,
    assignedDevices,
    unassignedDevices,
  });
}

async function filterDevices(filters) {
  const { assignment, search } = filters;

  let query = "SELECT * FROM iot_devices WHERE 1=1";
  const params = [];

  if (assignment === "assigned") {
    query += " AND mobileNo IS NOT NULL";
  } else if (assignment === "unassigned") {
    query += " AND mobileNo IS NULL";
  }

  if (search) {
    query += " AND deviceId LIKE ?";
    params.push(`%${search}%`);
  }

  const [rows] = await digitalAgriPool.query(query, params);

  return rows.map((row) => new DeviceDTO(row));
}

async function getSensorHistory(deviceId, startDate, endDate) {
  const [rows] = await digitalAgriPool.query(
    `
      SELECT deviceId, sensorKey, sensorValue, ts
      FROM iot_sensor_readings
      WHERE deviceId = ?
        AND ts BETWEEN ? AND ?
      ORDER BY ts ASC
    `,
    [deviceId, startDate, endDate]
  );

  const grouped = new Map();

  for (const row of rows) {
    const ts = row.ts.toISOString();

    if (!grouped.has(ts)) {
      grouped.set(ts, new SensorHistoryDTO(ts));
    }

    grouped.get(ts).values[row.sensorKey] = row.sensorValue;
  }

  return [...grouped.values()];
}

async function getEarliestTimestamp(deviceId) {
  const [[{ start }]] = await digitalAgriPool.query(
    `SELECT MIN(ts) AS start
     FROM iot_sensor_readings
     WHERE deviceId = ?`,
    [deviceId]
  );

  return start;
}

async function resolveDateRange(deviceId, start, end) {
  let startDate = start;
  let endDate = end;

  const earliest = await getEarliestTimestamp(deviceId);
  const today = new Date().toISOString().substring(0, 10);

  if (start && !end) endDate = today;
  if (!start && end) startDate = earliest;
  if (!start && !end) {
    throw new Error("Provide start or end date");
  }

  return { startDate, endDate };
}

async function getSensorHistoryCSV(deviceId, start, end) {
  const { startDate, endDate } = await resolveDateRange(
    deviceId,
    start,
    end
  );

  return getSensorHistory(deviceId, startDate, endDate);
}

async function getUserDeviceSummary(mobileNo) {
  const [rows] = await digitalAgriPool.query(
    `
      SELECT
        COUNT(*) AS totalDevices,
        SUM(CASE WHEN is_setup_completed = 1 THEN 1 ELSE 0 END) AS setupDone,
        SUM(CASE WHEN status = 'online' AND is_setup_completed = 1 THEN 1 ELSE 0 END) AS online,
        SUM(CASE WHEN status = 'offline' AND is_setup_completed = 1 THEN 1 ELSE 0 END) AS offline
      FROM iot_devices
      WHERE mobileNo = ?;
    `,
    [mobileNo]
  );

  return new DeviceSummaryDTO(rows[0]);
}

async function getReadyDevicesByMobileNo(mobileNo) {
  const [rows] = await digitalAgriPool.query(
    `
      SELECT deviceId, deviceName
      FROM iot_devices
      WHERE mobileNo = ?
        AND is_setup_completed = 1
      ORDER BY registeredAt DESC
    `,
    [mobileNo]
  );

  return rows.map((row) => new ReadyDeviceDTO(row));
}

export {
  createDevice,
  getAllDevices,
  getDeviceById,
  updateDevice,
  deleteDevice,
  assignDeviceToUser,
  getDashboardSummary,
  filterDevices,
  getSensorHistory,
  getEarliestTimestamp,
  resolveDateRange,
  getSensorHistoryCSV,
  getDevicesByMobileNo,
  getUserDeviceSummary,
  getReadyDevicesByMobileNo,
};
