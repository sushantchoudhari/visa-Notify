import pinoHttp from 'pino-http';
import { logger } from '../../config/logger';

export const requestLogger = pinoHttp({
  logger,
  customSuccessMessage(req, res) {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  customErrorMessage(req, res, err) {
    return `${req.method} ${req.url} ${res.statusCode} — ${err.message}`;
  },
  serializers: {
    req(req) {
      return { method: req.method, url: req.url, id: req.id };
    },
  },
});
