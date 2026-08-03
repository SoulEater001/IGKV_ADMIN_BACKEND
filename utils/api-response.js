class ApiResponse {
  constructor(data, message = "Success", statusCode = 200, success = true) {
    this.data = data;
    this.message = message;
    this.timestamp = new Date().toISOString();
    this.status = statusCode;
    this.success = success;
  }
}

export default ApiResponse;
