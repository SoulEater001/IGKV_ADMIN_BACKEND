import ApiResponse from '../utils/api-response.js'
import * as filterService from "../services/filters.service.js"

async function fetchLocationHierarchy(req, res) {
  try {
    const data = await filterService.getLocationHierarchy();
    const response = new ApiResponse(
      data,
      "Location hierarchy fetched successfully",
      200,
      true
    );
    res.status(200).json(response);
  } catch (err) {
    res
      .status(500)
      .json(
        new ApiResponse(null, "Failed to fetch location hierarchy", 500, false)
      );
  }
}

async function fetchCropList(req, res) {
  try {
    // console.log("req received")
    const data = await filterService.getCropList();
    // console.log("Backend reached", data)
    const response = new ApiResponse(
      data,
      "Crop list fetched successfully",
      200,
      true
    );
    res.status(200).json(response);
  } catch (err) {
    res
      .status(500)
      .json(new ApiResponse(null, "Failed to fetch crop list", 500, false));
  }
}

async function getAllDistricts(req, res) {
  try {
    const data = await filterService.getAllDistricts();

    const response = new ApiResponse(
      data,
      "District list fetched successfully",
      200,
      true
    );

    res.status(200).json(response);
  } catch (err) {
    res
      .status(500)
      .json(new ApiResponse(null, "Failed to fetch district list", 500, false));
  }
}

export { fetchLocationHierarchy, fetchCropList, getAllDistricts };
