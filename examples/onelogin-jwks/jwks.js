const { readFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const { importSPKI, exportJWK } = require('jose');

function parseCsv(value) {
  if (!value) return [];
  return value.split(',').map((v) => v.trim()).filter(Boolean);
}

function getKeySources() {
  const primary = {
    kid: process.env.JWK_KID,
    path: process.env.PUBLIC_KEY_PATH || './keys/public_key.pem',
  };

  const extraKids = parseCsv(process.env.JWKS_ADDITIONAL_KIDS);
  const extraPaths = parseCsv(process.env.JWKS_ADDITIONAL_PUBLIC_KEY_PATHS);

  if (extraKids.length !== extraPaths.length) {
    throw new Error('JWKS_ADDITIONAL_KIDS and JWKS_ADDITIONAL_PUBLIC_KEY_PATHS must have same count');
  }

  const all = [primary];
  for (let i = 0; i < extraKids.length; i += 1) {
    all.push({ kid: extraKids[i], path: extraPaths[i] });
  }

  const uniqueKids = new Set(all.map((k) => k.kid));
  if (uniqueKids.size !== all.length) {
    throw new Error('Duplicate kid values are not allowed');
  }

  return all;
}

async function pemToJwk({ kid, path }) {
  const pem = await readFile(resolve(process.cwd(), path), 'utf8');
  const keyLike = await importSPKI(pem, 'RS256');
  const jwk = await exportJWK(keyLike);

  if (jwk.kty !== 'RSA' || !jwk.n || !jwk.e) {
    throw new Error(`Key at ${path} is not a valid RSA public signing key`);
  }

  return {
    kty: 'RSA',
    use: 'sig',
    alg: 'RS256',
    kid,
    n: jwk.n,
    e: jwk.e,
  };
}

async function buildJwksResponse() {
  const keySources = getKeySources();
  const keys = await Promise.all(keySources.map(pemToJwk));
  return { keys };
}

module.exports = {
  buildJwksResponse,
};
