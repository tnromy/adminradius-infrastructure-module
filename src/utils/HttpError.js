class HttpError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'HttpError';
  }

  toResponse() {
    return {
      status: 'error',
      statusCode: this.statusCode,
      message: this.message,
      ...(this.details && { details: this.details })
    };
  }

  static forbidden(message) {
    return new HttpError(403, message);
  }

  static notFound(message) {
    return new HttpError(404, message);
  }

  static badRequest(message, details = null) {
    return new HttpError(400, message, details);
  }

  static internal(message = 'Internal Server Error') {
    return new HttpError(500, message);
  }
}

module.exports = HttpError; 