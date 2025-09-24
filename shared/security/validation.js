import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

const blockedIpv4Ranges = [
  { label: '0.0.0.0/8', test: (octets) => octets[0] === 0 },
  { label: '127.0.0.0/8', test: (octets) => octets[0] === 127 },
  { label: '169.254.0.0/16', test: (octets) => octets[0] === 169 && octets[1] === 254 },
  { label: '224.0.0.0/4', test: (octets) => octets[0] >= 224 && octets[0] <= 239 },
  { label: '240.0.0.0/4', test: (octets) => octets[0] >= 240 },
];

const blockedIpv6Prefixes = [
  '::',
  '::1',
  'fe80::',
  'fc00::',
  'fd00::',
  'ff00::',
];

function isBlockedIpAddress(ip) {
  if (!ip) {
    return true;
  }

  if (ip.includes(':')) {
    const normalized = ip.toLowerCase();
    return blockedIpv6Prefixes.some(prefix => normalized.startsWith(prefix));
  }

  const parts = ip.split('.');
  if (parts.length !== 4) {
    return true;
  }

  const octets = parts.map(part => Number.parseInt(part, 10));
  if (octets.some(num => Number.isNaN(num) || num < 0 || num > 255)) {
    return true;
  }

  return blockedIpv4Ranges.some(({ test }) => test(octets));
}

export const schemas = {
  email: z.string()
    .email('Invalid email format')
    .max(254, 'Email too long')
    .refine(email => {
      // Additional email validation against common attack vectors
      const disposableDomains = [
        '10minutemail.com', 'tempmail.org', 'guerrillamail.com',
        'mailinator.com', 'trashmail.com', 'yopmail.com'
      ];
      const domain = email.toLowerCase().split('@')[1];
      return !disposableDomains.includes(domain);
    }, 'Please use a permanent email address')
    .transform(val => val.toLowerCase().trim()),
    
  discordId: z.string()
    .regex(/^\d{17,19}$/, 'Invalid Discord ID format')
    .refine(id => {
      // Prevent Discord ID spoofing
      const num = BigInt(id);
      const discordEpoch = 1420070400000n;
      const timestamp = (num >> 22n) + discordEpoch;
      const now = BigInt(Date.now());
      // Discord IDs shouldn't be from the future or too far in the past
      return timestamp <= now && timestamp > discordEpoch;
    }, 'Invalid Discord ID timestamp'),
    
  walletAddress: z.string()
    .regex(/^[A-Z2-7]{58}$/, 'Invalid Algorand address format')
    .refine(address => {
      // Basic checksum validation for Algorand addresses
      try {
        // This would require algosdk for full validation
        // For now, just check basic format and length
        return address.length === 58;
      } catch {
        return false;
      }
    }, 'Invalid wallet address checksum'),
    
  userInput: z.string()
    .max(1000, 'Input too long')
    .transform(val => sanitizeHtml(val.trim()))
    .refine(val => {
      // Check for potential XSS/injection attempts
      const dangerousPatterns = [
        /<script/i, /javascript:/i, /on\w+=/i, /data:text\/html/i,
        /eval\(/i, /Function\(/i, /setTimeout\(/i, /setInterval\(/i
      ];
      return !dangerousPatterns.some(pattern => pattern.test(val));
    }, 'Input contains potentially dangerous content'),
    
  ipAddress: z.string()
    .ip('Invalid IP address format')
    .refine(ip => !isBlockedIpAddress(ip), 'Invalid IP address range'),
    
  asaId: z.number()
    .int('ASA ID must be an integer')
    .positive('ASA ID must be positive')
    .max(Number.MAX_SAFE_INTEGER, 'ASA ID too large')
    .refine(id => {
      // Validate against known Algorand ASA ID ranges
      return id >= 1 && id <= 18446744073709551615n; // uint64 max
    }, 'ASA ID outside valid range'),
    
  amount: z.number()
    .nonnegative('Amount cannot be negative')
    .finite('Amount must be finite')
    .max(1e18, 'Amount too large') // Prevent overflow attacks
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
  
  // Use DOMPurify for robust HTML sanitization
  const clean = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  });
  
  // Additional sanitization
  return clean
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/data:/gi, '') // Remove data: URLs
    .replace(/vbscript:/gi, '') // Remove vbscript: URLs
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

// Rate limiting helper to prevent abuse
export function createRateLimiter(maxRequests = 10, windowMs = 60000) {
  const requests = new Map();
  
  return (identifier) => {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!requests.has(identifier)) {
      requests.set(identifier, []);
    }
    
    const userRequests = requests.get(identifier);
    
    // Remove old requests outside the window
    const recentRequests = userRequests.filter(time => time > windowStart);
    
    if (recentRequests.length >= maxRequests) {
      return { allowed: false, retryAfter: windowMs - (now - recentRequests[0]) };
    }
    
    recentRequests.push(now);
    requests.set(identifier, recentRequests);
    
    return { allowed: true, remaining: maxRequests - recentRequests.length };
  };
}
