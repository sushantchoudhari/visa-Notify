import express, { Application, Request, Response } from 'express';
import { requestLogger } from './shared/middleware/requestLogger';
import { errorHandler } from './shared/middleware/errorHandler';
import { paymentRouter } from './modules/payments/payment.controller';
import { payWebhookRouter } from './modules/pay-webhooks/payWebhook.controller';
import { notifyRouter } from './modules/notify/notify.controller';
import { notifyCallbackRouter } from './modules/notify-callback/notifyCallback.controller';
import { jwksRouter } from './modules/onelogin/jwks.controller';
import { oneLoginAuthRouter } from './modules/onelogin/oneLoginAuth.controller';

export function createApp(): Application {
  const app = express();

  // ---------------------------------------------------------------------------
  // Request logging
  // ---------------------------------------------------------------------------
  app.use(requestLogger);

  // ---------------------------------------------------------------------------
  // JSON body parser (global)
  // Capture raw body for GOV.UK Pay webhook signature verification
  // ---------------------------------------------------------------------------
  app.use(express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      const expressReq = req as Request;
      if (expressReq.originalUrl.startsWith('/api/v1/pay/webhooks')) {
        expressReq.rawBody = Buffer.from(buf);
      }
    },
  }));

  // ---------------------------------------------------------------------------
  // Health endpoint
  // ---------------------------------------------------------------------------
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ---------------------------------------------------------------------------
  // Routes
  // ---------------------------------------------------------------------------
  app.use('/api/v1', paymentRouter);
  app.use('/api/v1/pay/webhooks', payWebhookRouter);
  app.use('/api/v1/notifications', notifyRouter);
  app.use('/api/v1/notify/callbacks', notifyCallbackRouter);
  app.use('/api/v1/onelogin', oneLoginAuthRouter);

  // JWKS — served at /.well-known/jwks.json (public, no /api prefix)
  app.use('/.well-known', jwksRouter);

  // ---------------------------------------------------------------------------
  // 404 fallback
  // ---------------------------------------------------------------------------
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  // ---------------------------------------------------------------------------
  // Error handler (must be last)
  // ---------------------------------------------------------------------------
  app.use(errorHandler);

  return app;
}
