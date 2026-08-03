import ApiResponse from '../utils/api-response.js'
import * as chartService from '../services/chart.service.js'

async function getCropDistribution(req, res) {
  try {
    const data = await chartService.getCropDistribution();
    res
      .status(200)
      .json(new ApiResponse(data, "Crop distribution fetched", 200, true));
  } catch (err) {
    res
      .status(500)
      .json(
        new ApiResponse(null, "Failed to fetch crop distribution", 500, false)
      );
  }
}

async function getDistrictDistribution(req, res) {
  try {
    const data = await chartService.getDistrictDistribution();
    res
      .status(200)
      .json(new ApiResponse(data, "District distribution fetched", 200, true));
  } catch (err) {
    res
      .status(500)
      .json(
        new ApiResponse(
          null,
          "Failed to fetch district distribution",
          500,
          false
        )
      );
  }
}

async function getCropCountHeatmap(req, res) {
  try {
    const data = await chartService.getCropCountHeatmap();
    res
      .status(200)
      .json(new ApiResponse(data, "Crop count heatmap fetched", 200, true));
  } catch (err) {
    console.error("Heatmap Error:", err);
    res
      .status(500)
      .json(
        new ApiResponse(
          null,
          "Failed to fetch crop count heatmap",
          500,
          false
        )
      );
  }
}


export {
  getCropDistribution,
  getDistrictDistribution,
  getCropCountHeatmap
};
