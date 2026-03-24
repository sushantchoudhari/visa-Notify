const { readFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const { randomUUID } = require('node:crypto');
const { importPKCS8, SignJWT } = require('jose');

let cachedKey;

async function getPrivateKey() {
  if (cachedKey) return cachedKey;

  const privatePath = process.env.PRIVATE_KEY_PATH || './keys/private_key.pem';
  const privatePem = await readFile(resolve(process.cwd(), privatePath), 'utf8');
  cachedKey = await importPKCS8(privatePem, 'RS256');
  return cachedKey;
}

async function signClientAssertion(clientId, audience) {
  const key = await getPrivateKey();
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({
    iss: clientId,
    sub: clientId,
    aud: audience,
    jti: randomUUID(),
  })
    .setProtectedHeader({
      alg: 'RS256',
      kid: process.env.JWK_KID,
      typ: 'JWT',
    })
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(key);
}

module.exports = {
  signClientAssertion,
};
