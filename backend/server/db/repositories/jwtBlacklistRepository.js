const { query } = require('../../db/pg');

async function add({ jti, token_hash, expires_at }) {
  if (!jti || !expires_at) return;
  await query(
    `INSERT INTO jwt_blacklist(jti, token, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [jti, token_hash || '', expires_at]
  );
}

async function isBlacklisted(jti) {
  if (!jti) return false;
  const { rows } = await query(
    `SELECT 1 FROM jwt_blacklist
      WHERE jti = $1
        AND NOW() < expires_at
      LIMIT 1`,
    [jti]
  );
  return !!rows.length;
}

async function pruneExpired() {
  await query(`DELETE FROM jwt_blacklist WHERE expires_at < NOW()`);
}

module.exports = { add, isBlacklisted, pruneExpired };
