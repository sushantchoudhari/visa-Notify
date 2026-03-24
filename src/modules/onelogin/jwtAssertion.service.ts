/**
 * JWT signing service for GOV.UK One Login private_key_jwt authentication.
 *
 * Requirements:
 * - Sign with RS256 using the private key matching the active JWK
 * - Include kid in the JWT header matching the JWKS kid
 * - Standard claims: iss, sub, aud, jti, iat, exp
 */

import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { importPKCS8, JWTPayload, KeyLike, SignJWT } from 'jose';
import { env } from '../../config/env';
import { AppError } from '../../shared/errors/AppError';

let privateSigningKey: KeyLike | null = null;

async function getPrivateSigningKey(): Promise<KeyLike> {
  if (privateSigningKey) {
    return privateSigningKey;
  }

  try {
    const privateKeyPem = await readFile(resolve(process.cwd(), env.PRIVATE_KEY_PATH), 'utf8');
    privateSigningKey = await importPKCS8(privateKeyPem, 'RS256');
    return privateSigningKey;
  } catch {
    throw new AppError('Failed to load private signing key', 500, 'JWT_PRIVATE_KEY_LOAD_FAILED');
  }
}

/**
 * Build a short-lived RS256 JWT with a deterministic kid in the protected header.
 * One Login uses kid to locate the matching public key in JWKS.
 */
async function signJwt(payload: JWTPayload, audience: string, issuer: string, subject?: string): Promise<string> {
  const keyLike = await getPrivateSigningKey();
  const now = Math.floor(Date.now() / 1000);

  const signer = new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: env.JWK_KID, typ: 'JWT' })
    .setIssuer(issuer)
    .setAudience(audience)
    .setJti(randomUUID())
    .setIssuedAt(now)
    .setExpirationTime(now + 300);

  if (subject) {
    signer.setSubject(subject);
  }

  return signer.sign(keyLike);
}

export const jwtAssertionService = {
  async signClientAssertion(clientId: string, audience: string): Promise<string> {
    return signJwt({
      iss: clientId,
      sub: clientId,
      aud: audience,
      jti: randomUUID(),
    }, audience, clientId, clientId);
  },

  async signRequestJwt(payload: JWTPayload, audience: string, issuer: string): Promise<string> {
    return signJwt(payload, audience, issuer);
  },
};
