/**
 * JWKS service for GOV.UK One Login.
 * Exposes RSA public signing keys in JWKS format.
 *
 * GOV.UK One Login requirements:
 * - JWKS endpoint must be public, HTTPS, respond to GET
 * - Return 200 within 5 seconds
 * - Each key must have a unique kid
 * - Keys are cached by One Login for up to 24 hours — plan rotation carefully
 */

import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { exportJWK, importSPKI } from 'jose';
import { env } from '../../config/env';
import { AppError } from '../../shared/errors/AppError';

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

interface KeySource {
  kid: string;
  publicKeyPath: string;
}

const JWKS_CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { value: JWKSResponse; expiresAt: number } | null = null;

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map((v) => v.trim()).filter(Boolean);
}

function getKeySources(): KeySource[] {
  const sources: KeySource[] = [{
    kid: env.JWK_KID,
    publicKeyPath: env.PUBLIC_KEY_PATH,
  }];

  const additionalKids = parseCsv(env.JWKS_ADDITIONAL_KIDS);
  const additionalPaths = parseCsv(env.JWKS_ADDITIONAL_PUBLIC_KEY_PATHS);

  if (additionalKids.length !== additionalPaths.length) {
    throw new AppError(
      'JWKS_ADDITIONAL_KIDS and JWKS_ADDITIONAL_PUBLIC_KEY_PATHS must have the same count',
      500,
      'JWKS_ROTATION_CONFIG_INVALID',
    );
  }

  for (let i = 0; i < additionalKids.length; i += 1) {
    sources.push({ kid: additionalKids[i] as string, publicKeyPath: additionalPaths[i] as string });
  }

  const uniqueKids = new Set(sources.map((s) => s.kid));
  if (uniqueKids.size !== sources.length) {
    throw new AppError('Duplicate JWKS kid values are not allowed', 500, 'JWKS_DUPLICATE_KID');
  }

  return sources;
}

async function loadJwkFromPem(source: KeySource): Promise<JWK> {
  const publicKeyPath = resolve(process.cwd(), source.publicKeyPath);
  const publicKeyPem = await readFile(publicKeyPath, 'utf8');

  const keyLike = await importSPKI(publicKeyPem, 'RS256');
  const jwk = await exportJWK(keyLike);

  if (jwk.kty !== 'RSA' || !jwk.n || !jwk.e) {
    throw new AppError('Configured public key is not a valid RSA signing key', 500, 'JWKS_KEY_INVALID');
  }

  return {
    kty: 'RSA',
    use: 'sig',
    alg: 'RS256',
    kid: source.kid,
    n: jwk.n,
    e: jwk.e,
  };
}

export const jwksService = {
  async getPublicKeys(): Promise<JWKSResponse> {
    if (cache && cache.expiresAt > Date.now()) {
      return cache.value;
    }

    try {
      const keySources = getKeySources();
      const keys = await Promise.all(keySources.map(loadJwkFromPem));

      const jwks = { keys };
      cache = {
        value: jwks,
        expiresAt: Date.now() + JWKS_CACHE_TTL_MS,
      };

      return jwks;
    } catch (err) {
      if (err instanceof AppError) {
        throw err;
      }

      throw new AppError('Failed to load JWKS public key', 500, 'JWKS_LOAD_FAILED');
    }
  },
};
