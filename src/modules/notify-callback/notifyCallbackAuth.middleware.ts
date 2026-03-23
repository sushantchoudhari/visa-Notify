import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';
import { UnauthorizedError } from '../../shared/errors/AppError';

/**
 * Shared-secret bearer token check for GOV.UK Notify callbacks.
 * This keeps callback endpoints non-public even before payload validation.
 */
export function notifyCallbackAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid Authorization header');
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (token !== env.NOTIFY_CALLBACK_BEARER_TOKEN) {
    throw new UnauthorizedError('Invalid callback bearer token');
  }

  next();
}
