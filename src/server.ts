import 'dotenv/config';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { db } from './config/db';
import { payWebhookService } from './modules/pay-webhooks/payWebhook.service';
import { notifyCallbackService } from './modules/notify-callback/notifyCallback.service';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'HTTP server listening');
});

// ---------------------------------------------------------------------------
// DB-backed webhook poller
// Polls every 10 s for PENDING webhook events. No Redis required.
// ---------------------------------------------------------------------------
const POLL_INTERVAL_MS = 10_000;
const pollerTimer = payWebhookService.startPolling(POLL_INTERVAL_MS);
logger.info({ intervalMs: POLL_INTERVAL_MS }, 'Webhook poller started');

const notifyCallbackPollerTimer = notifyCallbackService.startPolling(POLL_INTERVAL_MS);
logger.info({ intervalMs: POLL_INTERVAL_MS }, 'Notify callback poller started');

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutdown signal received');

  clearInterval(pollerTimer);
  clearInterval(notifyCallbackPollerTimer);

  server.close(async () => {
    try {
      await db.$disconnect();
      logger.info('Database connection closed. Exiting.');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during database disconnect');
      process.exit(1);
    }
  });

  // Force exit if graceful shutdown stalls after 10 s
  setTimeout(() => {
    logger.error('Forced exit after shutdown timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
process.on('SIGINT',  () => { void shutdown('SIGINT'); });

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — shutting down');
  void shutdown('uncaughtException');
});
