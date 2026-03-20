/**
 * GOV.UK One Login domain helpers.
 * Phase 6 — TODO: implement OIDC flows, PKCE, nonce, id_token validation.
 */

export interface OidcTokenSet {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
}

export interface OidcUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  phone_number?: string;
}

export const oneLoginDomain = {
  buildAuthorizationUrl(_params: {
    clientId: string;
    redirectUri: string;
    state: string;
    nonce: string;
    scope?: string;
  }): string {
    throw new Error('not implemented');
  },

  validateIdToken(_idToken: string, _nonce: string): OidcUserInfo {
    throw new Error('not implemented');
  },
};
