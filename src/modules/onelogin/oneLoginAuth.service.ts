/**
 * GOV.UK One Login authentication service.
 * Phase 6 — TODO: implement full OIDC authorization code flow with PKCE.
 */

export const oneLoginAuthService = {
  async startAuthFlow(_redirectUri: string): Promise<{ authorizationUrl: string; state: string }> {
    throw new Error('not implemented');
  },

  async handleCallback(_code: string, _state: string): Promise<{ sub: string; email?: string }> {
    throw new Error('not implemented');
  },
};
