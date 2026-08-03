class VillageDTO {
  constructor(villageId, villageName) {
    this.villageId = villageId;
    this.villageName = villageName;
  }
}

class TehsilDTO {
  constructor(tehsilId, tehsilName, villages = []) {
    this.tehsilId = tehsilId;
    this.tehsilName = tehsilName;
    this.villages = villages;
  }
}

class DistrictDTO {
  constructor(districtId, districtName, tehsils = []) {
    this.districtId = districtId;
    this.districtName = districtName;
    this.tehsils = tehsils;
  }
}

class CropDTO {
  constructor(cropCode, cropName) {
    this.cropCode = cropCode;
    this.cropName = cropName;
  }
}

class DistrictOnlyDTO {
  constructor(districtId, districtName) {
    this.districtId = districtId;
    this.districtName = districtName;
  }
}

export{
  VillageDTO,
  TehsilDTO,
  DistrictDTO,
  CropDTO,
  DistrictOnlyDTO,
};
