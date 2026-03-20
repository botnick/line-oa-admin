import * as crypto from 'crypto';

/**
 * LINE webhook signature verification.
 * Validates that the payload was genuinely sent by LINE.
 */

/**
 * Verify LINE webhook signature.
 * @param channelSecret - LINE Messaging API Channel Secret
 * @param body - Raw request body (string)
 * @param signature - Value of `x-line-signature` header
 * @returns true if signature is valid
 */
export function verifySignature(
  channelSecret: string,
  body: string,
  signature: string
): boolean {
  const hmac = crypto.createHmac('SHA256', channelSecret);
  hmac.update(body);
  const expected = hmac.digest('base64');

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'base64'),
      Buffer.from(expected, 'base64')
    );
  } catch {
    return false;
  }
}
