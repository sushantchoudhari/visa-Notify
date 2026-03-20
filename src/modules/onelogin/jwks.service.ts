/**
 * JWKS service for GOV.UK One Login.
 * Phase 6 — TODO: implement PEM → JWK conversion and key exposure.
 *
 * GOV.UK One Login requirements:
 * - JWKS endpoint must be public, HTTPS, respond to GET
 * - Return 200 within 5 seconds
 * - Each key must have a unique kid
 * - Keys are cached by One Login for up to 24 hours — plan rotation carefully
 */

export interface JWK {
  kty: string;
  use: string;
  alg: string;
  kid: string;
  n: string;
  e: string;
}

export interface JWKSResponse {
  keys: JWK[];
}

export const jwksService = {
  async getPublicKeys(): Promise<JWKSResponse> {
    throw new Error('not implemented');
  },
};
