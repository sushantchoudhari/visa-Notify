/**
 * JWT client assertion service for GOV.UK One Login private_key_jwt authentication.
 * Phase 6 — TODO: implement using jose library.
 *
 * Requirements:
 * - Sign with RS256 using the private key matching the active JWK
 * - Include kid in the JWT header matching the JWKS kid
 * - Standard claims: iss, sub, aud, jti, iat, exp
 */

export const jwtAssertionService = {
  async signClientAssertion(_clientId: string, _audience: string): Promise<string> {
    throw new Error('not implemented');
  },
};
