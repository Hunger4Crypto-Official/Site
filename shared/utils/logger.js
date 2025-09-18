import pino from 'pino';

function redactAddress(s) {
  if (!s || typeof s !== 'string') return s;
  if (s.length < 10) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function redactSensitiveData(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const redacted = { ...obj };
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
  
  for (const field of sensitiveFields) {
    if (redacted[field]) {
      redacted[field] = '[REDACTED]';
    }
  }
  
  // Redact wallet addresses
  for (const [key, value] of Object.entries(redacted)) {
    if (typeof value === 'string' && (key.includes('address') || key.includes('wallet'))) {
      redacted[key] = redactAddress(value);
    }
  }
  
  return redacted;
}

const transport = process.env.NODE_ENV !== 'production' 
  ? { 
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'yyyy-mm-dd HH:MM:ss',
        ignore: 'pid,hostname'
      }
    }
  : undefined;

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport,
  base: {
    service: 'h4c-bot',
    version: process.env.npm_package_version || '1.0.0'
  },
  formatters: {
    log: (obj) => redactSensitiveData(obj)
  },
  hooks: {
    logMethod(args, method) {
      // Redact sensitive information in log messages
      const scrubbedArgs = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          return redactSensitiveData(arg);
        }
        if (typeof arg === 'string') {
          // Redact wallet addresses in strings
          return arg.replace(
            /(addr|address|wallet)\s*[=:]\s*([A-Za-z0-9]{20,58})/gi,
            (match, key, value) => `${key}=${redactAddress(value)}`
          );
        }
        return arg;
      });
      
      method.apply(this, scrubbedArgs);
    }
  },
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err
  }
});

// Add performance timing utility
export function createTimer(operation) {
  const start = process.hrtime.bigint();
  
  return {
    end: () => {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000; // Convert to milliseconds
      logger.debug({ operation, duration }, 'Operation completed');
      return duration;
    }
  };
}

// Add structured logging helpers
export const loggerHelpers = {
  logRequest: (req, res, responseTime) => {
    const logData = {
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      responseTime,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.socket.remoteAddress,
      requestId: req.id
    };
    
    const level = res.statusCode >= 400 ? 'warn' : 'info';
    logger[level](logData, 'HTTP Request');
  },
  
  logDiscordCommand: (interaction, duration, success = true) => {
    logger.info({
      command: interaction.commandName,
      user: interaction.user.tag,
      guild: interaction.guild?.name,
      duration,
      success
    }, 'Discord command executed');
  },
  
  logBadgeAward: (userId, badgeId, success = true, reason = '') => {
    logger.info({
      userId: redactAddress(userId),
      badgeId,
      success,
      reason
    }, 'Badge award attempt');
  },
  
  logApiCall: (service, endpoint, duration, success = true, statusCode = null) => {
    const logData = {
      service,
      endpoint,
      duration,
      success,
      statusCode
    };
    
    const level = success ? 'debug' : 'warn';
    logger[level](logData, 'External API call');
  }
};
