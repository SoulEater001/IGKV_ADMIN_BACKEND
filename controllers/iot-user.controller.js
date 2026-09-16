import ApiResponse from "../utils/api-response.js"
import * as userService from "../services/iot-user.service.js";

// Get all users
async function getAllUsers(req, res) {
  try {
    const data = await userService.getAllUsers();
    res.status(200).json(new ApiResponse(data, "Users fetched", 200, true));
  } catch (err) {
    res.status(500).json(new ApiResponse(null, err.message, 500, false));
  }
}

// Get one user
async function getUserByMobile(req, res) {
  try {
    const mobileNo = req.params.mobileNo;
    const data = await userService.getUserByMobile(mobileNo);
    res.status(200).json(new ApiResponse(data, "User fetched", 200, true));
  } catch (err) {
    res.status(404).json(new ApiResponse(null, err.message, 404, false));
  }
}

// Update user
async function updateUser(req, res) {
  try {
    const mobileNo = req.params.mobileNo;
    const data = await userService.updateUser(mobileNo, req.body);
    res.status(200).json(new ApiResponse(data, "User updated", 200, true));
  } catch (err) {
    res.status(500).json(new ApiResponse(null, err.message, 500, false));
  }
}

// Delete user
async function deleteUser(req, res) {
  try {
    const mobileNo = req.params.mobileNo;
    await userService.deleteUser(mobileNo);
    res.status(200).json(new ApiResponse(null, "User deleted", 200, true));
  } catch (err) {
    res.status(500).json(new ApiResponse(null, err.message, 500, false));
  }
}

async function getAllUsersWithDevices(req, res) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);

    const limit = Math.min(
      Math.max(Number(req.query.limit) || 10, 1),
      100
    );

    const search = String(req.query.search || "").trim();

    const result = await userService.getAllUsersWithDevices(
      page,
      limit,
      search
    );

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      data: null,
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
      search: "",
      message: err.message,
    });
  }
}

async function saveFcmToken(req, res) {
  try {
    const { mobileNo, fcmToken, mobileDeviceId, platform } = req.body;

    if (!mobileNo || !fcmToken || !mobileDeviceId) {
      return res.status(400).json(
        new ApiResponse(null, "mobileNo, fcmToken and mobileDeviceId required", 400, false)
      );
    }

    await userService.saveFcmToken(
      mobileNo,
      mobileDeviceId,
      fcmToken,
      platform || 'android'
    );

    res.status(200).json(
      new ApiResponse(null, "FCM token saved", 200, true)
    );
  } catch (err) {
    res.status(500).json(
      new ApiResponse(null, err.message, 500, false)
    );
  }
}


export {
  getAllUsers,
  getUserByMobile,
  updateUser,
  deleteUser,
  getAllUsersWithDevices,
  saveFcmToken,
};
