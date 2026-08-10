// Signs/verifies the one-click "Confirm & Activate" link sent to the
// platform admin when a shop submits an upgrade request.
//
// Deliberately NOT a JWT via JWT_ACCESS_SECRET - that secret authenticates
// shop users, and reusing it here would let a shop-user token and an
// activation token be forged from the same key material. This uses its own
// HMAC over PLATFORM_ADMIN_KEY instead: that secret already exists (it gates
// every /api/admin/* route), only the operator holds it, and rotating it
// naturally invalidates any outstanding activation links too.
//
// This token is NOT itself an authorization credential - clicking the link
// still requires the admin to unlock the console with PLATFORM_ADMIN_KEY,
// exactly like the manual Activate button. It only carries WHAT to activate
// (shop/plan/duration/TRX) so the admin doesn't have to look it up and
// retype it, and is verified server-side before anything is written to the
// database.
const crypto = require('crypto');

const TTL_SECONDS = 14 * 24 * 60 * 60; // 14 days - long enough to review email at leisure

const base64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromBase64url = (str) => Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const getSecret = () => {
  const secret = process.env.PLATFORM_ADMIN_KEY;
  if (!secret) throw new Error('PLATFORM_ADMIN_KEY must be set to sign activation tokens');
  return secret;
};

const sign = (payload) => {
  const body = { ...payload, iat: Math.floor(Date.now() / 1000) };
  body.exp = body.iat + TTL_SECONDS;
  const encodedBody = base64url(Buffer.from(JSON.stringify(body), 'utf8'));
  const signature = base64url(crypto.createHmac('sha256', getSecret()).update(encodedBody).digest());
  return `${encodedBody}.${signature}`;
};

// Returns the decoded payload if valid, or null if the token is malformed,
// tampered with, or expired. Uses a constant-time comparison so this can't
// leak signature bytes via response-time side channels.
const verify = (token) => {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [encodedBody, signature] = token.split('.');
  if (!encodedBody || !signature) return null;

  const expectedSignature = base64url(crypto.createHmac('sha256', getSecret()).update(encodedBody).digest());
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload;
  try {
    payload = JSON.parse(fromBase64url(encodedBody).toString('utf8'));
  } catch {
    return null;
  }

  if (!payload.exp || Math.floor(Date.now() / 1000) > payload.exp) return null;
  return payload;
};

module.exports = { sign, verify };
