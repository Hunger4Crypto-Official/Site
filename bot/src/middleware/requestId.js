import { randomBytes } from 'node:crypto';
export function requestIdMiddleware(req, _res, next) {
  req.id = randomBytes(8).toString('hex');
  next();
}
