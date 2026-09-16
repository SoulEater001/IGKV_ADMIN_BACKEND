import ApiResponse from "../utils/api-response.js";
import * as deviceService from "../services/device.service.js";
import { Parser } from "json2csv";
import formatToIST from "../utils/format-ist.js";

async function createDevice(req, res) {
  try {
    const data = await deviceService.createDevice(req.body);
    res.status(201).json(new ApiResponse(data, "Device created", 201, true));
  } catch (err) {
    res.status(500).json(new ApiResponse(null, err.message, 500, false));
  }
}

async function getAllDevices(req, res) {
  try {
    const data = await deviceService.getAllDevices();
    res.status(200).json(new ApiResponse(data, "Devices fetched", 200, true));
  } catch (err) {
    res.status(500).json(new ApiResponse(null, err.message, 500, false));
  }
}

const getDevicesPaginated = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);
    const search = (req.query.search || '').trim();
    const assignment = req.query.assignment || '';
    const deviceType = req.query.deviceType || '';

    const result = await deviceService.getDevicesPaginated(
      page,
      limit,
      search,
      assignment,
      deviceType
    );

    const { rows, total } = result;

    return res.json({
      success: true,
      data: rows,
      total,
      page,
      limit
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch devices.'
    });
  }
};

async function getDeviceById(req, res) {
  try {
    // console.log("req reached")
    const deviceId = req.params.deviceId;
    const data = await deviceService.getDeviceById(deviceId);
    // console.log(data)
    res.status(200).json(new ApiResponse(data, "Device fetched", 200, true));
  } catch (err) {
    res.status(404).json(new ApiResponse(null, err.message, 404, false));
  }
}

// async function getDevicesByMobileNo(req, res) {
//   try {
//     const { mobileNo } = req.params;

//     const data = await deviceService.getDevicesByMobileNo(mobileNo);

//     res
//       .status(200)
//       .json(new ApiResponse(data, "User devices fetched", 200, true));
//   } catch (err) {
//     res.status(500).json(new ApiResponse(null, err.message, 500, false));
//   }
// }

async function updateDevice(req, res) {
  try {
    const deviceId = req.params.deviceId;
    const data = await deviceService.updateDevice(deviceId, req.body);
    res.status(200).json(new ApiResponse(data, "Device updated", 200, true));
  } catch (err) {
    res.status(500).json(new ApiResponse(null, err.message, 500, false));
  }
}

async function deleteDevice(req, res) {
  try {
    const deviceId = req.params.deviceId;
    const deletedBy = req.user.id;

    const data = await deviceService.deleteDevice(
      deviceId,
      deletedBy
    );

    return res
      .status(200)
      .json(new ApiResponse(data, "Device deleted", 200, true));
  } catch (err) {
    const statusCode =
      err.message === "Device not found" ? 404 : 500;

    return res
      .status(statusCode)
      .json(new ApiResponse(null, err.message, statusCode, false));
  }
}

async function assignDeviceToUser(req, res) {
  try {
    const { mobileNo } = req.body;
    const deviceId = req.params.deviceId;

    const data = await deviceService.assignDeviceToUser(deviceId, mobileNo);

    res
      .status(200)
      .json(new ApiResponse(data, "Device assigned to user", 200, true));
  } catch (err) {
    res.status(400).json(new ApiResponse(null, err.message, 400, false));
  }
}

async function getDashboardSummary(req, res) {
  try {
    const data = await deviceService.getDashboardSummary();
    res
      .status(200)
      .json(new ApiResponse(data, "Dashboard summary fetched", 200, true));
  } catch (err) {
    res.status(500).json(new ApiResponse(null, err.message, 500, false));
  }
}

async function getSensorHistory(req, res) {
  try {
    const { deviceId } = req.params;
    let { start, end } = req.query;

    if (!start && !end) {
      return res
        .status(400)
        .json(
          new ApiResponse(
            null,
            "Provide at least start or end date",
            400,
            false,
          ),
        );
    }

    // If only end is provided → fetch earliest timestamp from DB
    if (!start && end) {
      start = await deviceService.getEarliestTimestamp(deviceId);
      if (!start) {
        return res
          .status(404)
          .json(
            new ApiResponse(
              null,
              "No sensor data found for device",
              404,
              false,
            ),
          );
      }
    }

    // If only start is provided → use today 23:59:59
    if (start && !end) {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      end = today;
    }

    // Convert "date" into full-day range
    const startDate = new Date(start);
    const endDate = new Date(end);

    // Force BOTH to include full possible range
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const data = await deviceService.getSensorHistory(
      deviceId,
      startDate,
      endDate,
    );

    res
      .status(200)
      .json(new ApiResponse(data, "Sensor history fetched", 200, true));
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json(
        new ApiResponse(null, "Failed to fetch sensor history", 500, false),
      );
  }
}

async function exportSensorHistoryCSV(req, res) {
  try {
    const { deviceId } = req.params;
    const { start, end } = req.query;

    // Resolve date range (smart logic)
    const { startDate, endDate } = await deviceService.resolveDateRange(
      deviceId,
      start,
      end,
    );

    // Fetch grouped history
    const history = await deviceService.getSensorHistory(
      deviceId,
      startDate,
      endDate,
    );

    if (!history || history.length === 0) {
      return res
        .status(404)
        .json(new ApiResponse(null, "No data found for export", 404, false));
    }

    // Build CSV rows
    const csvRows = history.map((entry) => ({
      timestamp: `'${formatToIST(entry.timestamp)}`,
      ...entry.values,
    }));

    // 🔥 Build dynamic CSV header (important!)
    const allHeaders = new Set();
    csvRows.forEach((row) => {
      Object.keys(row).forEach((key) => allHeaders.add(key));
    });

    const fields = Array.from(allHeaders);

    // Convert JSON → CSV with explicit fields
    const parser = new Parser({ fields });
    const csv = parser.parse(csvRows);

    res.header("Content-Type", "text/csv");
    res.attachment(`sensor_history_${deviceId}.csv`);
    return res.send(csv);
  } catch (err) {
    console.error("CSV Export Error:", err);
    return res
      .status(500)
      .json(new ApiResponse(null, "Failed to export CSV", 500, false));
  }
}

// async function getUserDeviceSummary(req, res) {
//   try {
//     const { mobileNo } = req.params;

//     const data = await deviceService.getUserDeviceSummary(mobileNo);

//     res
//       .status(200)
//       .json(new ApiResponse(data, "User device summary fetched", 200, true));
//   } catch (err) {
//     res.status(500).json(new ApiResponse(null, err.message, 500, false));
//   }
// }

// async function getReadyDevices(req, res) {
//   try {
//     const { mobileNo } = req.params;

//     const data = await deviceService.getReadyDevicesByMobileNo(mobileNo);

//     res
//       .status(200)
//       .json(new ApiResponse(data, "Ready devices fetched", 200, true));
//   } catch (err) {
//     res.status(500).json(new ApiResponse(null, err.message, 500, false));
//   }
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
  getSensorHistory,
  exportSensorHistoryCSV,
  // getDevicesByMobileNo,
  // getUserDeviceSummary,
  // getReadyDevices,
};
