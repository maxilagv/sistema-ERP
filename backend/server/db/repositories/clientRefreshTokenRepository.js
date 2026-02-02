const { query } = require('../../db/pg');

async function saveRefreshToken({ cliente_id, token_hash, jti, user_agent, ip, expires_at }) {
  await query(
    `INSERT INTO clientes_refresh_tokens(cliente_id, token, jti, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [cliente_id, token_hash, jti, user_agent || null, ip || null, expires_at]
  );
}

async function revokeRefreshToken(token_hash) {
  await query(`UPDATE clientes_refresh_tokens SET revoked_at = NOW() WHERE token = $1`, [token_hash]);
}

async function isRefreshTokenValid(token_hash, meta = {}) {
  if (!token_hash) return false;
  const bindUa = process.env.REFRESH_TOKEN_BIND_UA === 'true';
  const bindIp = process.env.REFRESH_TOKEN_BIND_IP === 'true';
  if ((bindUa && !meta.user_agent) || (bindIp && !meta.ip)) return false;

  const params = [token_hash];
  const where = [
    'token = $1',
    'revoked_at IS NULL',
    'NOW() < expires_at',
  ];
  if (bindUa && meta.user_agent) {
    params.push(meta.user_agent);
    where.push(`user_agent = $${params.length}`);
  }
  if (bindIp && meta.ip) {
    params.push(meta.ip);
    where.push(`ip = $${params.length}`);
  }

  const { rows } = await query(
    `SELECT 1 FROM clientes_refresh_tokens
      WHERE ${where.join(' AND ')}
      LIMIT 1`,
    params
  );
  return !!rows.length;
}

module.exports = { saveRefreshToken, revokeRefreshToken, isRefreshTokenValid };
