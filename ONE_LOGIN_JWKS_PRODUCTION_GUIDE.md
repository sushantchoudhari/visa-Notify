# GOV.UK One Login JWKS Production Guide

This guide documents production-ready JWKS and JWT signing behavior for this service.

## 1) Implemented Endpoint

Public endpoint:

```text
GET /.well-known/jwks.json
```

Behavior:
1. Returns `200 OK`
2. Returns JSON in JWKS format: `{ "keys": [...] }`
3. Keys are RSA signing keys (`kty=RSA`, `use=sig`, `alg=RS256`)
4. Each key includes `kid`, `n`, and `e`
5. Endpoint is read-only

Code references:
1. `src/modules/onelogin/jwks.controller.ts`
2. `src/modules/onelogin/jwks.service.ts`

## 2) Key Source And Signing

Configured key files:
1. Public key path: `PUBLIC_KEY_PATH` (default example: `./keys/public_key.pem`)
2. Private key path: `PRIVATE_KEY_PATH` (default example: `./keys/private_key.pem`)

JWT signing:
1. Algorithm: `RS256`
2. Protected header includes `kid` from `JWK_KID`
3. `kid` in JWT header matches `kid` exposed by JWKS

Code reference:
1. `src/modules/onelogin/jwtAssertion.service.ts`

## 3) Environment Variables

Required:

```env
JWK_KID=key-2024-01-01
PUBLIC_KEY_PATH=./keys/public_key.pem
PRIVATE_KEY_PATH=./keys/private_key.pem
```

Optional key-rotation support:

```env
JWKS_ADDITIONAL_KIDS=key-2023-12-01,key-2023-06-01
JWKS_ADDITIONAL_PUBLIC_KEY_PATHS=./keys/public_key_old.pem,./keys/public_key_older.pem
```

Rules:
1. `JWKS_ADDITIONAL_KIDS` and `JWKS_ADDITIONAL_PUBLIC_KEY_PATHS` must have equal item counts.
2. `kid` values must be unique.

## 4) Curl Test Example

```bash
curl -s http://localhost:3000/.well-known/jwks.json
```

Expected shape:

```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "alg": "RS256",
      "kid": "key-2024-01-01",
      "n": "...",
      "e": "AQAB"
    }
  ]
}
```

## 5) Example JWT With kid Header

Example protected header (decoded):

```json
{
  "alg": "RS256",
  "kid": "key-2024-01-01",
  "typ": "JWT"
}
```

Example token generated during local verification:

```text
eyJhbGciOiJSUzI1NiIsImtpZCI6ImtleS0yMDI0LTAxLTAxIiwidHlwIjoiSldUIn0.eyJpc3MiOiJleGFtcGxlLWNsaWVudC1pZCIsInN1YiI6ImV4YW1wbGUtY2xpZW50LWlkIiwiYXVkIjoiaHR0cHM6Ly9vaWRjLmludGVncmF0aW9uLmFjY291bnQuZ292LnVrL3Rva2VuIiwianRpIjoiMzM4Nzc1ODAtYTUzNS00ZTdjLTg4YzEtZWEzZDRiYzE0Zjc5IiwiaWF0IjoxNzc0Mzc3NTg5LCJleHAiOjE3NzQzNzc4ODl9.TQsLgIA2dpht4lrvsjHsork8AHb5Ki-oQ92XC16mxAIl1-4tLJskc2utwynJkvdj_TNaUb_PEJNkJDp6TT2yG9sMveGfwl0zm-4j4Z3IF6QvKuoSjWm4Ho6z1soU3DQEuheiOsxofH_H9VZHRkjiakapqMkS0sEt64-B6Hfc6A8AyW2awZ_gdMCmFIVCmRXalmvZCynKR_TD-FIGC0NmIF2BqO-C_RfPQExkK0mKHkhxEDVMORHON1kuh6mNwPvEDkq80rnfZdZTM9YO-fBNB9aAbCkjVEre6P1bUAblSNsBFt1XNt07_0g6ocvqQts3YUTZhbmVgnEv_9jAKWd4aA
```

## 6) Why kid Must Match JWKS

The verifier reads `kid` from the JWT header and uses it to select the correct public key from JWKS.

If `kid` in the JWT does not match any key in JWKS:
1. Verifier cannot find the key
2. Signature verification fails
3. Token is rejected

## 7) Key Rotation Strategy

Safe rotation pattern:
1. Generate new RSA key pair and new `kid`
2. Start signing new tokens with new private key and new `kid`
3. Publish both old and new public keys in JWKS for overlap period
4. Wait for old tokens to expire and caches to refresh
5. Remove old key from JWKS

Important:
1. Keep overlap long enough for verifier cache TTL and token expiry window
2. Never reuse `kid` across different key material

## 8) Security Boundaries

Must stay secure (never public):
1. `private_key.pem`
2. Secrets and credentials (client secrets, bearer secrets)
3. Any KMS access credentials

Can be public:
1. JWKS endpoint output (`kid`, `n`, `e`, `kty`, `use`, `alg`)
2. Public key file (`public_key.pem`)

## 9) Operational Notes

1. Service caches generated JWKS in-process for a short period to reduce repeated key parsing.
2. Use file permissions to restrict private key read access.
3. Prefer secret managers/KMS in non-local environments.
4. Monitor endpoint health and 5xx responses for key loading failures.

## 10) Reference JavaScript Structure

A plain Node.js/Express reference implementation is included at:
1. `examples/onelogin-jwks/app.js`
2. `examples/onelogin-jwks/jwks.js`
3. `examples/onelogin-jwks/jwtSigner.js`

This mirrors the requested structure while production runtime remains in TypeScript modules under `src/modules/onelogin`.
