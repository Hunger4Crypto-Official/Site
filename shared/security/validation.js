import { z } from 'zod';

export const schemas = {
  email: z.string()
    .email('Invalid email format')
    .max(254, 'Email too long')
    .transform(val => val.toLowerCase().trim()),
    
  discordId: z.string()
    .regex(/^\d{17,19}$/, 'Invalid Discord ID format'),
    
  walletAddress: z.string()
    .regex(/^[A-Z2-7]{58}$/, 'Invalid Algorand address format'),
    
  userInput: z.string()
    .max(1000, 'Input too long')
    .transform(val => sanitizeHtml(val.trim())),
    
  ipAddress: z.string()
    .ip('Invalid IP address format'),
    
  asaId: z.number()
    .int('ASA ID must be an integer')
    .positive('ASA ID must be positive'),
    
  amount: z.number()
    .nonnegative('Amount cannot be negative')
    .finite('Amount must be finite')
};

export function validateInput(schema, data) {
  try {
    return { success: true, data: schema.parse(data) };
  } catch (error) {
    return { 
      success: false, 
      errors: error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
        code: e.code
      }))
    };
  }
}

export function sanitizeHtml(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '') // Remove HTML brackets
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

export function validateBatch(validations) {
  const results = {};
  const errors = [];
  
  for (const [key, { schema, data }] of Object.entries(validations)) {
    const result = validateInput(schema, data);
    if (result.success) {
      results[key] = result.data;
    } else {
      errors.push({ field: key, errors: result.errors });
    }
  }
  
  return errors.length > 0 
    ? { success: false, errors }
    : { success: true, data: results };
}
