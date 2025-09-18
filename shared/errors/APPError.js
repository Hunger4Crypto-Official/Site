export class AppError extends Error {
  constructor(message, code = 'INTERNAL_ERROR', statusCode = 500, isOperational = true) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
  
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      isOperational: this.isOperational
    };
  }
}

export class ValidationError extends AppError {
  constructor(message, field = null) {
    super(message, 'VALIDATION_ERROR', 400);
    this.field = field;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR', 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 'AUTHORIZATION_ERROR', 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 'NOT_FOUND', 404);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service = 'Service') {
    super(`${service} temporarily unavailable`, 'SERVICE_UNAVAILABLE', 503);
  }
}
