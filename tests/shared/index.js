// Main exports for @h4c/shared package

export * from './constants.js';
export * from './utils.js';

// Import and re-export criteria
import criteriaJson from './criteria.json' assert { type: 'json' };
export const criteria = criteriaJson;

// Version info
export const version = '1.0.0';
export const name = '@h4c/shared';
