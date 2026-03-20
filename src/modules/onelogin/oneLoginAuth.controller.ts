import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { oneLoginAuthService } from './oneLoginAuth.service';

export const oneLoginAuthRouter = Router();

/**
 * GET /api/v1/onelogin/start
 * Initiates the GOV.UK One Login authorization code flow.
 * Phase 6 — TODO: implement
 */
oneLoginAuthRouter.get(
  '/start',
  asyncHandler(async (req, res) => {
    const redirectUri = `${req.protocol}://${req.get('host')}/api/v1/onelogin/callback`;
    const { authorizationUrl } = await oneLoginAuthService.startAuthFlow(redirectUri);
    res.redirect(authorizationUrl);
  }),
);

/**
 * GET /api/v1/onelogin/callback
 * Handles the callback from GOV.UK One Login after authentication.
 * Phase 6 — TODO: implement
 */
oneLoginAuthRouter.get(
  '/callback',
  asyncHandler(async (req, res) => {
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code || !state) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Missing code or state' } });
      return;
    }
    const user = await oneLoginAuthService.handleCallback(code, state);
    res.json({ data: user });
  }),
);
