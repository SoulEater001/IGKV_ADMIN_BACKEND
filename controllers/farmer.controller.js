import ApiResponse from '../utils/api-response.js'
import * as farmerService from '../services/farmer.service.js'

async function getDistrictSummary(req, res) {
  try {
    const { cropCode, farmerType, districtId } = req.query;

    const data = await farmerService.getDistrictSummary(
      cropCode,
      farmerType,
      districtId
    );

    return res.status(200).json(
      new ApiResponse(
        data,
        "District summary fetched successfully",
        200,
        true
      )
    );

  } catch (err) {
    console.error("[FarmerController:getDistrictSummary]", err);

    return res.status(500).json(
      new ApiResponse(
        null,
        "Failed to fetch district summary",
        500,
        false
      )
    );
  }
}

async function getTehsilSummary(req, res) {
  try {
    const { cropCode, farmerType, districtId } = req.query;

    if (!districtId) {
      return res.status(400).json(
        new ApiResponse(
          null,
          "districtId is required for tehsil summary",
          400,
          false
        )
      );
    }

    const data = await farmerService.getTehsilSummary(
      cropCode,
      farmerType,
      districtId
    );

    return res.status(200).json(
      new ApiResponse(
        data,
        "Tehsil summary fetched successfully",
        200,
        true
      )
    );
  } catch (err) {
    console.error(err);

    return res.status(500).json(
      new ApiResponse(
        null,
        "Failed to fetch tehsil summary",
        500,
        false
      )
    );
  }
}

async function getVillageSummary(req, res) {
  try {
    const { cropCode, farmerType, districtId, tehsilNo } = req.query;

    if (!districtId || !tehsilNo) {
      return res.status(400).json(
        new ApiResponse(
          null,
          "districtId and tehsilNo are required",
          400,
          false
        )
      );
    }

    const data = await farmerService.getVillageSummary(
      cropCode,
      farmerType,
      districtId,
      tehsilNo
    );

    const response = new ApiResponse(
      data,
      "Village summary fetched successfully",
      200,
      true
    );

    return res.status(200).json(response);

  } catch (err) {
    console.error("[FarmerController:getVillageSummary]", err);

    return res.status(500).json(
      new ApiResponse(
        null,
        "Failed to fetch village summary",
        500,
        false
      )
    );
  }
}

async function getFarmerBasicList(req, res) {
  try {
    const { districtId, tehsilNo, villageId, cropCode } = req.query;

    // Validation rules (hierarchy)
    if (villageId && (!districtId || !tehsilNo)) {
      return res
        .status(400)
        .json(
          new ApiResponse(
            null,
            "districtId and tehsilNo are required when using villageId",
            400,
            false
          )
        );
    }
    if (tehsilNo && !districtId) {
      return res
        .status(400)
        .json(
          new ApiResponse(
            null,
            "districtId is required when using tehsilNo",
            400,
            false
          )
        );
    }

    const data = await farmerService.getFarmerBasicList(
      districtId,
      tehsilNo,
      villageId,
      cropCode
    );

    let statusCode = 200;
    if (Array.isArray(data.items) && data.items.length === 0) {
      statusCode = 404;
    }

    const response = new ApiResponse(
      data,
      statusCode === 200
        ? "Farmer list fetched successfully"
        : "No farmers found",
      statusCode,
      statusCode === 200
    );

    res.status(statusCode).json(response);
  } catch (err) {
    const errorResponse = new ApiResponse(
      null,
      "Failed to fetch farmer list",
      500,
      false
    );
    res.status(500).json(errorResponse);
  }
}

async function getHomeSummary(req, res) {
  try {
    // console.log("req reached")
    const data = await farmerService.getHomeSummary();

    const response = new ApiResponse(
      data,
      "Home summary fetched successfully",
      200,
      true
    );

    res.status(200).json(response);
  } catch (err) {
    const errorResponse = new ApiResponse(
      null,
      "Failed to fetch home summary",
      500,
      false
    );
    res.status(500).json(errorResponse);
  }
}

async function farmerProfileDetails(req, res) {
  try {
    const { ufId } = req.params;

    if (!ufId) {
      return res
        .status(400)
        .json(new ApiResponse(null, "UfId is required", 400, false));
    }

    const data = await farmerService.getFarmerProfileDetails(ufId);

    if (!data) {
      return res
        .status(404)
        .json(new ApiResponse(null, "User Not Found", 404, false));
    }

    const response = new ApiResponse(
      data,
      "Farmer Profile Fetched Successfully",
      200,
      true
    );

    return res.status(200).json(response);
  } catch (err) {
    console.error("[Controller:farmerProfileDetails] Error:", err.message);
    console.error(err); // full stack trace

    const errorResponse = new ApiResponse(
      null,
      "Failed to fetch farmer profile details",
      500,
      false
    );
    return res.status(500).json(errorResponse);
  }
}

async function getFarmerLandDetails(req, res) {
  try {
    const { ufId } = req.params;

    if (!ufId) {
      return res
        .status(400)
        .json(new ApiResponse(null, "ufId is required", 400, false));
    }

    const data = await farmerService.getFarmerLandDetails(ufId);

    const response = new ApiResponse(
      data,
      "Farmer land details fetched successfully",
      200,
      true
    );

    return res.status(200).json(response);
  } catch (err) {
    console.error("[Controller:getFarmerLandDetails] Error:", err.message);

    const errorResponse = new ApiResponse(
      null,
      "Failed to fetch farmer land details",
      500,
      false
    );

    return res.status(500).json(errorResponse);
  }
}

async function getFarmerCropDetails(req, res) {
  try {
    const { ufId } = req.params;

    if (!ufId) {
      return res
        .status(400)
        .json(new ApiResponse(null, "ufId is required", 400, false));
    }

    const data = await farmerService.getFarmerCropDetails(ufId);

    const response = new ApiResponse(
      data,
      "Farmer crop details fetched successfully",
      200,
      true
    );

    return res.status(200).json(response);
  } catch (err) {
    console.error("[Controller:getFarmerCropDetails] Error:", err.message);
    return res
      .status(500)
      .json(
        new ApiResponse(null, "Failed to fetch farmer crop details", 500, false)
      );
  }
}

export {
  getDistrictSummary,
  getTehsilSummary,
  getVillageSummary,
  getFarmerBasicList,
  getHomeSummary,
  farmerProfileDetails,
  getFarmerLandDetails,
  getFarmerCropDetails
};
