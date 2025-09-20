import { AppError } from '../errors/AppError.js';
import { logger } from './logger.js';

const DEFAULT_ERROR = new AppError('Unexpected error occurred', 'INTERNAL_ERROR', 500, false);

export const DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred. Please try again later.';

export function createErrorHandler(context = 'application') {
  return (error) => {
    if (error instanceof AppError) {
      return error;
    }

    const message = error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE;

    logger.error({ context, error: String(error) }, 'Unhandled error captured');

    return new AppError(message || DEFAULT_ERROR.message, DEFAULT_ERROR.code, DEFAULT_ERROR.statusCode, false);
  };
}

export function asyncWrapper(fn, context = fn?.name || 'asyncOperation') {
  if (typeof fn !== 'function') {
    throw new TypeError('asyncWrapper requires a function');
  }

  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      throw createErrorHandler(context)(error);
    }
  };
}
