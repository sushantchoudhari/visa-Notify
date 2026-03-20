import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

/**
 * Captures the raw request body as a Buffer before any body-parser processes it.
 * Must be placed before express.json() on routes that require HMAC signature verification.
 *
 * Usage: app.use('/api/v1/pay/webhooks', rawBody, express.json(), ...)
 */
export function rawBody(req: Request, _res: Response, next: NextFunction): void {
  const chunks: Buffer[] = [];

  req.on('data', (chunk: Buffer) => {
    chunks.push(chunk);
  });

  req.on('end', () => {
    req.rawBody = Buffer.concat(chunks);
    next();
  });

  req.on('error', next);
}
