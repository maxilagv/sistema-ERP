const crypto = require('crypto');

function hashWithSecret(secret, token) {
  if (!token) return null;
  if (secret) {
    return crypto.createHmac('sha256', secret).update(token).digest('hex');
  }
  return crypto.createHash('sha256').update(token).digest('hex');
}

function hashAccessToken(token) {
  const secret = process.env.ACCESS_TOKEN_HASH_SECRET || process.env.JWT_SECRET;
  return hashWithSecret(secret || '', token);
}

function hashRefreshToken(token) {
  const secret =
    process.env.REFRESH_TOKEN_HASH_SECRET ||
    process.env.REFRESH_TOKEN_SECRET ||
    process.env.JWT_SECRET;
  return hashWithSecret(secret || '', token);
}

module.exports = { hashAccessToken, hashRefreshToken };
