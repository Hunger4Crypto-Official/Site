import { Env } from './envGuard.js';

let budget = Env.GLOBAL_CALL_BUDGET_5M;
let lastReset = Date.now();

export async function budgeted(call) {
  const now = Date.now();
  if (now - lastReset > 300000) { budget = Env.GLOBAL_CALL_BUDGET_5M; lastReset = now; }
  if (--budget < 0) throw new Error('BUDGET_EXCEEDED');

  let delay = 500;
  for (let i = 0; i < 4; i++) {
    try { return await call(); }
    catch (e) {
      const msg = String(e);
      if (!/429|5\d\d|UNREACHABLE|HTTP_50\d/.test(msg)) throw e;
      await new Promise(r => setTimeout(r, delay));
      delay = Math.min(delay * 2, 8000);
    }
  }
  throw new Error('RETRY_GAVE_UP');
}
