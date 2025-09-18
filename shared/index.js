// shared/src/index.js - Centralized exports
export * from './constants.js';
export * from './utils.js';
export * from './types.js';
export * from './criteria.js';

// Default exports for main components
export { logger } from './utils.js';
export { AppError, createErrorResponse } from './utils.js';
export { BADGE_THRESHOLDS, REPUTATION_WEIGHTS } from './criteria.js';
