import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { jwksService } from './jwks.service';

export const jwksRouter = Router();

/**
 * GET /.well-known/jwks.json
 *
 * Public JWKS endpoint required by GOV.UK One Login.
 * Must:
 * - Be publicly accessible over HTTPS
 * - Respond within 5 seconds
 * - Return 200 with { keys: [...] }
 * - Each key must include a unique kid
 *
 * Phase 6 — TODO: implement jwksService.getPublicKeys()
 */
jwksRouter.get(
  '/jwks.json',
  asyncHandler(async (_req, res) => {
    const jwks = await jwksService.getPublicKeys();
    res
      .status(200)
      .set('Cache-Control', 'public, max-age=3600')
      .json(jwks);
  }),
);
