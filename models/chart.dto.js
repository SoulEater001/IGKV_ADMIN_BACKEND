class CropDistributionDTO {
  constructor(cropCode, cropName, farmerCount) {
    this.cropCode = cropCode;
    this.cropName = cropName;
    this.farmerCount = farmerCount;
  }
}

class DistrictDistributionDTO {
  constructor(districtId, districtName, farmerCount) {
    this.districtId = districtId;
    this.districtName = districtName;
    this.farmerCount = farmerCount;
  }
}

class ProductionTrendDTO {
  constructor(month, totalProduction) {
    this.month = month;
    this.totalProduction = totalProduction;
  }
}

class DistrictCropDTO {
  constructor(cropCode, cropName, cropCount) {
    this.cropCode = cropCode;
    this.cropName = cropName;
    this.cropCount = cropCount;
  }
}

class DistrictCropHeatmapDTO {
  constructor(districtId, districtName, totalCropCount , crops=[]) {
    this.districtId = districtId;
    this.districtName = districtName;
    this.totalCropCount  = totalCropCount ;
    this.crops = crops;
  }
}

export {
  CropDistributionDTO,
  DistrictDistributionDTO,
  ProductionTrendDTO,
  DistrictCropHeatmapDTO,
  DistrictCropDTO
};
