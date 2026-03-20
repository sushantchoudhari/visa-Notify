import crypto from 'crypto';

/**
 * Verifies the Pay-Signature HMAC-SHA256 header from GOV.UK Pay webhooks.
 * Uses timingSafeEqual to prevent timing attacks.
 *
 * GOV.UK Pay signs the raw request body with your webhook signing secret.
 * The header value is the hex-encoded HMAC.
 */
export const paySignatureService = {
  verify(rawBody: Buffer, signatureHeader: string, secret: string): boolean {
    try {
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(rawBody);
      const expected = hmac.digest('hex');

      // Both buffers must be the same length for timingSafeEqual
      if (signatureHeader.length !== expected.length) {
        return false;
      }

      return crypto.timingSafeEqual(
        Buffer.from(signatureHeader, 'utf8'),
        Buffer.from(expected, 'utf8'),
      );
    } catch {
      return false;
    }
  },
};
