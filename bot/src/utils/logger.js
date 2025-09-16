import pino from 'pino';

function redactAddr(s) {
  if (!s || typeof s !== 'string') return s;
  if (s.length < 10) return s;
  return `${s.slice(0,6)}…${s.slice(-4)}`;
}

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
  hooks: {
    logMethod(args, method) {
      const scrubbed = args.map(a => {
        if (typeof a === 'string') return a.replace(/(addr|address|wallet)\s*=\s*([A-Za-z0-9]{20,58})/gi,
          (_m, k, v) => `${k}=${redactAddr(v)}`);
        return a;
      });
      method.apply(this, scrubbed);
    }
  }
});
