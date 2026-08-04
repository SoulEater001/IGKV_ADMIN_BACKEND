/**
 * Crop Table DTO
 */
class CropTableDTO {
  constructor(
    id,
    name,
    totalFarmers,
    totalArea,
    totalProduction,
    varietiesCount,
  ) {
    this.id = id;
    this.name = name;
    this.totalFarmers = totalFarmers;
    this.totalArea = totalArea;
    this.totalProduction = totalProduction;
    this.varietiesCount = varietiesCount;
  }
}

class CropSummaryResponse {
  constructor(items, totalFarmers, totalArea, totalProduction) {
    this.items = items;
    this.totalFarmers = totalFarmers;
    this.totalArea = totalArea;
    this.totalProduction = totalProduction;
  }
}

/**
 * Farmer Basic DTO
 */
class FarmerBasicDTO {
  constructor(farmerId, farmerName, mobileNo, villageName) {
    this.farmerId = farmerId;
    this.farmerName = farmerName;
    this.mobileNo = mobileNo;
    this.villageName = villageName;
  }
}

class FarmerBasicSummaryResponse {
  constructor(items, totalFarmers, totalArea, totalProduction) {
    this.items = items;
    this.totalFarmers = totalFarmers;
    this.totalArea = totalArea;
    this.totalProduction = totalProduction;
  }
}

/**
 * Farmer Personal Details
 */
class FarmerPersonalDTO {
  constructor(
    farmerId,
    farmerName,
    fatherName,
    aadharNumber,
    dob,
    age,
    gender,
    mobileNo,
    district,
    tehsil,
    village,
  ) {
    this.farmerId = farmerId;
    this.farmerName = farmerName;
    this.fatherName = fatherName;
    this.aadharNumber = aadharNumber;
    this.dob = dob;
    this.age = age;
    this.gender = gender;
    this.mobileNo = mobileNo;
    this.district = district;
    this.tehsil = tehsil;
    this.village = village;
  }
}

/**
 * Farmer Land DTO
 */
class FarmerLandDTO {
  constructor(
    khasraNo,
    basraNo,
    landArea,
    ownerName,
    patwariHalkaNo,
    irrigation,
    village,
  ) {
    this.khasraNo = khasraNo;
    this.basraNo = basraNo;
    this.landArea = landArea;
    this.ownerName = ownerName;
    this.patwariHalkaNo = patwariHalkaNo;
    this.irrigation = irrigation;
    this.village = village;
  }
}

/**
 * Farmer Crop DTO
 */
class FarmerCropDTO {
  constructor(cropCode, cropName, khasraNo, cropArea) {
    this.cropCode = cropCode;
    this.cropName = cropName;
    this.khasraNo = khasraNo;
    this.cropArea = cropArea;
  }
}

/**
 * Farmer Table DTO
 */
class FarmerTableDTO {
  constructor(id, name, totalFarmers, totalArea, cropArea, totalProduction, cropProduction, cropCount) {
    this.id = id;
    this.name = name;
    this.totalFarmers = totalFarmers;

    // Overall values
    this.totalArea = totalArea;
    this.totalProduction = totalProduction;

    // Selected crop values
    this.cropArea = cropArea;
    this.cropProduction = cropProduction;

    // Overall crop varieties
    this.cropCount = cropCount;
  }
}

class FarmerSummaryResponse {
  constructor(items, totalFarmers, totalArea, totalProduction) {
    this.items = items;
    this.totalFarmers = totalFarmers;
    this.totalArea = totalArea;
    this.totalProduction = totalProduction;
  }
}

export {
  CropTableDTO,
  CropSummaryResponse,
  FarmerBasicDTO,
  FarmerBasicSummaryResponse,
  FarmerPersonalDTO,
  FarmerLandDTO,
  FarmerCropDTO,
  FarmerTableDTO,
  FarmerSummaryResponse,
};
