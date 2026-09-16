class IotUserDTO {
  constructor(row) {
    this.id = row.id;
    this.userName = row.userName;
    this.mobileNo = row.mobileNo;
    this.createdAt = row.createdAt;
  }
}

class IotUserListDTO {
  constructor(row) {
    this.userName = row.userName;
    this.mobileNo = row.mobileNo;
    this.devices = row.devices || []; 
  }
}

export { IotUserDTO, IotUserListDTO };
