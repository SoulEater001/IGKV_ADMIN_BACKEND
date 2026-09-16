import { digitalAgriPool } from '../config/digitalAgriDb.js';
import { IotUserDTO, IotUserListDTO } from '../models/iot-user.dto.js';

// Get all users
async function getAllUsers() {
  const [rows] = await digitalAgriPool.query(`
    SELECT *
    FROM iot_users
    ORDER BY id DESC
  `);

  return rows.map((row) => new IotUserDTO(row));
}

// Users with devices
async function getAllUsersWithDevices(page = 1, limit = 10, search = "") {
  const offset = (page - 1) * limit;

  const searchTerm = `%${search}%`;

  // Total users matching search
  const [countRows] = await digitalAgriPool.query(
    `
      SELECT COUNT(*) AS total
      FROM iot_users
      WHERE userName LIKE ?
         OR mobileNo LIKE ?
    `,
    [searchTerm, searchTerm]
  );

  const total = Number(countRows[0].total);

  // Paginated users + their devices
  const [rows] = await digitalAgriPool.query(
    `
      SELECT
        u.userName,
        u.mobileNo,
        GROUP_CONCAT(d.deviceId) AS devices
      FROM iot_users u
      LEFT JOIN iot_devices d
        ON d.mobileNo = u.mobileNo
      WHERE u.userName LIKE ?
         OR u.mobileNo LIKE ?
      GROUP BY
        u.id,
        u.userName,
        u.mobileNo
      ORDER BY u.id DESC
      LIMIT ? OFFSET ?
    `,
    [searchTerm, searchTerm, limit, offset]
  );

  const data = rows.map(
    (row) =>
      new IotUserListDTO({
        userName: row.userName,
        mobileNo: row.mobileNo,
        devices: row.devices ? row.devices.split(",") : [],
      })
  );

  return {
    success: true,
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    search,
  };
}

export {
  getAllUsers,
  getAllUsersWithDevices,
};