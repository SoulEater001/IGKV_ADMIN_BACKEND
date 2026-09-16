class DeviceDTO {
  constructor(row) {
    this.deviceId = row.deviceId;
    this.deviceName = row.deviceName;
    this.deviceType = row.deviceType;
    this.firmwareVersion = row.firmwareVersion;
    this.registeredAt = row.registeredAt;
    this.userName = row.userName;
    this.mobileNo = row.mobileNo;
    this.status = row.status;
    this.lastHeartbeat = row.lastHeartbeat;
    this.isSetupCompleted = row.is_setup_completed;
    this.latitude = row.latitude;
    this.longitude = row.longitude;
    this.lastGpsUpdated = row.last_gps_updated;
    this.intervalMs = row.interval_ms;
    this.connectionType = row.connection_type;
  }
}

class SensorHistoryDTO {
  constructor(timestamp) {
    this.timestamp = timestamp;
    this.values = {};
  }
}
class DeviceSummaryDTO {
  constructor(row) {
    this.totalDevices = Number(row.totalDevices) || 0;
    this.setupDone = Number(row.setupDone) || 0;
    this.online = Number(row.online) || 0;
    this.offline = Number(row.offline) || 0;
  }
}

class ReadyDeviceDTO {
  constructor(row) {
    this.deviceId = row.deviceId;
    this.deviceName = row.deviceName;
  }
}

class DeviceDashboardDTO {
  constructor({
    totalDevices,
    totalUsers,
    assignedDevices,
    unassignedDevices,
    wifiDevices,
    gsmDevices,
  }) {
    this.totalDevices = totalDevices;
    this.totalUsers = totalUsers;
    this.assignedDevices = assignedDevices;
    this.unassignedDevices = unassignedDevices;
    this.wifiDevices = wifiDevices;
    this.gsmDevices = gsmDevices;
  }
}

export {
  DeviceDTO,
  SensorHistoryDTO,
  DeviceSummaryDTO,
  ReadyDeviceDTO,
  DeviceDashboardDTO
};
