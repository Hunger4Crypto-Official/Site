import { logger } from '../utils/logger.js';
import { AppError } from './AppError.js';

export class ErrorHandler {
  static handle(error, context = '') {
    const isOperational = error instanceof AppError && error.isOperational;
    
    const sanitizedError = {
      message: isOperational ? error.message : 'Internal server error',
      code: error.code || 'INTERNAL_ERROR',
      statusCode: error.statusCode || 500,
      context,
      timestamp: new Date().toISOString(),
      requestId: context.requestId || null
    };
    
    // Log with appropriate level based on severity
    const logLevel = this.getLogLevel(error);
    const logData = {
      error: sanitizedError,
      stack: error.stack,
      isOperational,
      userId: context.userId || null,
      ip: context.ip || null
    };
    
    logger[logLevel](logData, `Error in ${context.operation || 'unknown'}`);
    
    // Alert on critical errors
    if (error.statusCode >= 500 && isOperational) {
      this.alertCriticalError(error, context);
    }
    
    return sanitizedError;
  }
  
  static getLogLevel(error) {
    if (error.statusCode >= 500) return 'error';
    if (error.statusCode >= 400) return 'warn';
    return 'info';
  }
  
  static alertCriticalError(error, context) {
    // TODO: Integrate with monitoring service (Datadog, New Relic, etc.)
    const alert = {
      severity: 'critical',
      service: 'h4c-bot',
      error: error.message,
      context: context.operation || 'unknown',
      timestamp: new Date().toISOString(),
      metadata: {
        statusCode: error.statusCode,
        code: error.code,
        userId: context.userId,
        ip: context.ip
      }
    };
    
    console.error('CRITICAL ERROR ALERT:', JSON.stringify(alert, null, 2));
    
    // Future: Send to monitoring service
    // await monitoringService.sendAlert(alert);
  }
  
  static createMiddleware() {
    return (error, req, res, next) => {
      const context = {
        operation: `${req.method} ${req.path}`,
        requestId: req.id,
        userId: req.user?.id,
        ip: this.getClientIp(req)
      };
      
      const handledError = this.handle(error, context);
      
      res.status(handledError.statusCode).json({
        ok: false,
        error: {
          message: handledError.message,
          code: handledError.code,
          timestamp: handledError.timestamp,
          requestId: handledError.requestId
        }
      });
    };
  }
  
  static getClientIp(req) {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
      return xForwardedFor.split(',')[0].trim();
    }
    return req.socket?.remoteAddress || 'unknown';
  }
  
  static async handleAsyncError(asyncFn) {
    return async (...args) => {
      try {
        return await asyncFn(...args);
      } catch (error) {
        throw error instanceof AppError ? error : new AppError(error.message);
      }
    };
  }
}
