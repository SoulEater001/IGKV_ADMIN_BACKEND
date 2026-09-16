import { digitalAgriPool } from "../config/digitalAgriDb.js";
import {
  DeviceDTO,
  SensorHistoryDTO,
  DeviceSummaryDTO,
  ReadyDeviceDTO,
  DeviceDashboardDTO
} from "../models/device.dto.js";

const ALLOWED_CONNECTION_TYPES = ['wifi', 'gsm'];

async function createDevice(body) {
  const {
    deviceId,
    deviceName = null,
    userName = null,
    deviceType,
    mobileNo,
    firmwareVersion,
    connectionType,
  } = body;

  if (!deviceId?.trim()) {
    throw new Error('Device ID is required');
  }

  if (!mobileNo?.trim()) {
    throw new Error('Mobile number is required');
  }

  if (!deviceType?.trim()) {
    throw new Error('Device type is required');
  }

  if (!firmwareVersion?.trim()) {
    throw new Error('Firmware version is required');
  }

  if (!connectionType?.trim()) {
    throw new Error('Connection type is required');
  }

  const normalizedDeviceId = deviceId.trim();
  const normalizedMobileNo = mobileNo.trim();
  const normalizedDeviceType = deviceType.trim();
  const normalizedFirmwareVersion = firmwareVersion.trim();
  const normalizedConnectionType = connectionType.trim().toLowerCase();

  if (!/^\d{10}$/.test(normalizedMobileNo)) {
    throw new Error('Mobile number must be a valid 10-digit number');
  }

  if (!ALLOWED_CONNECTION_TYPES.includes(normalizedConnectionType)) {
    throw new Error(
      `Invalid connection type. Allowed values: ${ALLOWED_CONNECTION_TYPES.join(', ')}`
    );
  }

  const [existing] = await digitalAgriPool.query(
    `
    SELECT id
    FROM iot_devices
    WHERE deviceId = ?
      AND deleted = 0
    LIMIT 1
  `,
    [normalizedDeviceId]
  );

  if (existing.length > 0) {
    throw new Error('Device already exists');
  }

  if (existing.length > 0) {
    throw new Error('Device already exists');
  }

  const query = `
    INSERT INTO iot_devices
      (
        deviceId,
        deviceName,
        userName,
        mobileNo,
        deviceType,
        firmwareVersion,
        connection_type
      )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  await digitalAgriPool.query(query, [
    normalizedDeviceId,
    deviceName,
    userName,
    normalizedMobileNo,
    normalizedDeviceType,
    normalizedFirmwareVersion,
    normalizedConnectionType
  ]);

  return {
    deviceId: normalizedDeviceId,
    deviceName,
    deviceType: normalizedDeviceType,
    userName,
    mobileNo: normalizedMobileNo,
    firmwareVersion: normalizedFirmwareVersion,
    connectionType: normalizedConnectionType
  };
}

async function updateDevice(deviceId, body) {
  const {
    mobileNo,
    deviceType,
    firmwareVersion,
    connectionType
  } = body;

  if (!deviceId?.trim()) {
    throw new Error('Device ID is required');
  }

  if (!mobileNo?.trim()) {
    throw new Error('Mobile number is required');
  }

  if (!deviceType?.trim()) {
    throw new Error('Device type is required');
  }

  if (!firmwareVersion?.trim()) {
    throw new Error('Firmware version is required');
  }

  if (!connectionType?.trim()) {
    throw new Error('Connection type is required');
  }

  const normalizedDeviceId = deviceId.trim();
  const normalizedMobileNo = mobileNo.trim();
  const normalizedDeviceType = deviceType.trim();
  const normalizedFirmwareVersion = firmwareVersion.trim();
  const normalizedConnectionType = connectionType.trim().toLowerCase();

  if (!/^\d{10}$/.test(normalizedMobileNo)) {
    throw new Error('Mobile number must be a valid 10-digit number');
  }

  if (!ALLOWED_CONNECTION_TYPES.includes(normalizedConnectionType)) {
    throw new Error(
      `Invalid connection type. Allowed values: ${ALLOWED_CONNECTION_TYPES.join(', ')}`
    );
  }

  const [existing] = await digitalAgriPool.query(
    `
    SELECT id
    FROM iot_devices
    WHERE deviceId = ?
      AND deleted = 0
    LIMIT 1
  `,
    [normalizedDeviceId]
  );

  if (existing.length === 0) {
    throw new Error('Device not found');
  }

  const query = `
  UPDATE iot_devices
  SET
    mobileNo = ?,
    deviceType = ?,
    firmwareVersion = ?,
    connection_type = ?
  WHERE deviceId = ?
    AND deleted = 0
`;

  await digitalAgriPool.query(query, [
    normalizedMobileNo,
    normalizedDeviceType,
    normalizedFirmwareVersion,
    normalizedConnectionType,
    normalizedDeviceId
  ]);

  return {
    deviceId: normalizedDeviceId,
    mobileNo: normalizedMobileNo,
    deviceType: normalizedDeviceType,
    firmwareVersion: normalizedFirmwareVersion,
    connectionType: normalizedConnectionType
  };
}

async function deleteDevice(deviceId, deletedBy) {
  if (!deviceId?.trim()) {
    throw new Error('Device ID is required');
  }

  if (!deletedBy) {
    throw new Error('Deleted by is required');
  }

  const normalizedDeviceId = deviceId.trim();

  const [existing] = await digitalAgriPool.query(
    `
      SELECT id
      FROM iot_devices
      WHERE deviceId = ?
        AND deleted = 0
      LIMIT 1
    `,
    [normalizedDeviceId]
  );

  if (existing.length === 0) {
    throw new Error('Device not found');
  }

  await digitalAgriPool.query(
    `
      UPDATE iot_devices
      SET
        deleted = 1,
        delete_datetime = NOW(),
        deleted_by = ?
      WHERE deviceId = ?
        AND deleted = 0
    `,
    [deletedBy, normalizedDeviceId]
  );

  return {
    deviceId: normalizedDeviceId
  };
}

async function getAllDevices() {
  const [rows] = await digitalAgriPool.query(
    `
      SELECT *
      FROM iot_devices
      WHERE deleted = 0
    `
  );

  return rows.map((row) => new DeviceDTO(row));
}

async function getDevicesPaginated(
  page,
  limit,
  search = '',
  assignment = '',
  deviceType = ''
) {
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE deleted = 0';
  const params = [];

  if (assignment === 'assigned') {
    whereClause += ' AND mobileNo IS NOT NULL AND mobileNo <> ""';
  } else if (assignment === 'unassigned') {
    whereClause += ' AND mobileNo IS NULL';
  }

  if (deviceType) {
    whereClause += ' AND deviceType = ?';
    params.push(deviceType);
  }

  if (search) {
    whereClause += ' AND deviceId LIKE ?';
    params.push(`%${search}%`);
  }

  const [rows] = await digitalAgriPool.query(
    `
      SELECT *
      FROM iot_devices
      ${whereClause}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `,
    [
      ...params,
      limit,
      offset
    ]
  );

  const [[countResult]] = await digitalAgriPool.query(
    `
      SELECT COUNT(*) AS total
      FROM iot_devices
      ${whereClause}
    `,
    params
  );

  return {
    rows: rows.map((row) => new DeviceDTO(row)),
    total: countResult.total
  };
}

async function getDeviceById(deviceId) {
  const [rows] = await digitalAgriPool.query(
    `
      SELECT *
      FROM iot_devices
      WHERE deviceId = ?
        AND deleted = 0
    `,
    [deviceId]
  );

  if (!rows.length) {
    throw new Error("Device not found");
  }

  return new DeviceDTO(rows[0]);
}

// async function getDevicesByMobileNo(mobileNo) {
//   const [rows] = await digitalAgriPool.query(
//     `
//       SELECT *
//       FROM iot_devices
//       WHERE mobileNo = ?
//       ORDER BY registeredAt DESC
//     `,
//     [mobileNo]
//   );

//   return rows.map((row) => new DeviceDTO(row));
// }

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
      AND deleted = 0
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
  const [[deviceCounts]] = await digitalAgriPool.query(`
    SELECT
      COUNT(*) AS totalDevices,
      SUM(mobileNo IS NOT NULL AND mobileNo <> '') AS assignedDevices,
      SUM(mobileNo IS NULL OR mobileNo = '') AS unassignedDevices,
      SUM(connection_type = 'wifi') AS wifiDevices,
      SUM(connection_type = 'gsm') AS gsmDevices
    FROM iot_devices
    WHERE deleted = 0
  `);

  const [[{ totalUsers }]] = await digitalAgriPool.query(`
    SELECT COUNT(*) AS totalUsers
    FROM iot_users
  `);

  return new DeviceDashboardDTO({
    totalDevices: Number(deviceCounts.totalDevices),
    totalUsers: Number(totalUsers),
    assignedDevices: Number(deviceCounts.assignedDevices || 0),
    unassignedDevices: Number(deviceCounts.unassignedDevices || 0),
    wifiDevices: Number(deviceCounts.wifiDevices || 0),
    gsmDevices: Number(deviceCounts.gsmDevices || 0),
  });
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

// async function getUserDeviceSummary(mobileNo) {
//   const [rows] = await digitalAgriPool.query(
//     `
//       SELECT
//         COUNT(*) AS totalDevices,
//         SUM(CASE WHEN is_setup_completed = 1 THEN 1 ELSE 0 END) AS setupDone,
//         SUM(CASE WHEN status = 'online' AND is_setup_completed = 1 THEN 1 ELSE 0 END) AS online,
//         SUM(CASE WHEN status = 'offline' AND is_setup_completed = 1 THEN 1 ELSE 0 END) AS offline
//       FROM iot_devices
//       WHERE mobileNo = ?;
//     `,
//     [mobileNo]
//   );

//   return new DeviceSummaryDTO(rows[0]);
// }

// async function getReadyDevicesByMobileNo(mobileNo) {
//   const [rows] = await digitalAgriPool.query(
//     `
//       SELECT deviceId, deviceName
//       FROM iot_devices
//       WHERE mobileNo = ?
//         AND is_setup_completed = 1
//       ORDER BY registeredAt DESC
//     `,
//     [mobileNo]
//   );

//   return rows.map((row) => new ReadyDeviceDTO(row));
// }

export {
  createDevice,
  getAllDevices,
  getDevicesPaginated,
  getDeviceById,
  updateDevice,
  deleteDevice,
  assignDeviceToUser,
  getDashboardSummary,
  getEarliestTimestamp,
  resolveDateRange,
  getSensorHistoryCSV,
  // getDevicesByMobileNo,
  // getUserDeviceSummary,
  // getReadyDevicesByMobileNo,
};
