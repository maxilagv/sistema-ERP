const jwt = require('jsonwebtoken');
const jwtBlacklist = require('../db/repositories/jwtBlacklistRepository');
const { hashAccessToken } = require('../utils/tokenHash');

// Claves y parametros JWT, desde variables de entorno
const SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET;
const JWT_ALG = process.env.JWT_ALG || 'HS256';

// Lista negra de tokens JWT invalidados (en memoria, para produccion real usar DB o Redis)
const tokenBlacklist = new Set();

async function isTokenBlacklisted(jti) {
  if (!jti) return false;
  if (tokenBlacklist.has(jti)) return true;
  return jwtBlacklist.isBlacklisted(jti);
}

/**
 * Middleware para verificar el token JWT de acceso.
 * Extrae el token del encabezado 'Authorization', lo verifica y adjunta la informacion del usuario a la solicitud.
 * Tambien verifica si el token esta en la lista negra.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 * @param {function} next - Funcion para pasar el control al siguiente middleware.
 */
async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Extraer el token del encabezado 'Bearer <token>'

  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  // Verificar que la clave secreta de JWT este definida
  if (!SECRET) {
    console.error('Error: La variable de entorno JWT_SECRET no esta definida para la verificacion del token.');
    return res.status(500).json({ error: 'Configuracion del servidor incompleta.' });
  }

  try {
    const verifyOptions = { algorithms: [JWT_ALG] };
    if (process.env.JWT_ISSUER) verifyOptions.issuer = process.env.JWT_ISSUER;
    if (process.env.JWT_AUDIENCE) verifyOptions.audience = process.env.JWT_AUDIENCE;
    const user = jwt.verify(token, SECRET, verifyOptions); // Verificar el token con restricciones
    const jti = user && user.jti ? user.jti : null;
    if (await isTokenBlacklisted(jti)) {
      return res.status(401).json({ error: 'Token invalido o revocado' });
    }
    if (user && user.role === 'cliente') {
      return res.status(403).json({ error: 'Token de cliente no autorizado' });
    }
    req.user = user; // Adjuntar info del usuario a la solicitud
    req.token = token; // Adjuntar el token actual para posible invalidacion
    next(); // Continuar con la siguiente funcion de middleware o ruta
  } catch (err) {
    console.error('Error de verificacion de token:', err.message);
    // 401 permite que el frontend intente refrescar el access token con el refresh token
    return res.status(401).json({ error: 'Token invalido o expirado' });
  }
}

/**
 * Agrega un token a la lista negra.
 * @param {string} token - El token JWT a invalidar.
 */
async function addTokenToBlacklist(token, decoded) {
  const jti = decoded && decoded.jti ? decoded.jti : null;
  if (jti) tokenBlacklist.add(jti);
  // Persistir en DB para sobrevivir reinicios
  try {
    const exp = decoded && decoded.exp ? decoded.exp : null;
    const expiresAt = exp ? new Date(exp * 1000) : new Date(Date.now() + 15 * 60 * 1000);
    const tokenHash = hashAccessToken(token) || '';
    await jwtBlacklist.add({ jti: jti || tokenHash, token_hash: tokenHash, expires_at: expiresAt });
  } catch (_) {
    // best-effort
  }
}

module.exports = authMiddleware;
module.exports.addTokenToBlacklist = addTokenToBlacklist;
module.exports.SECRET = SECRET;
module.exports.REFRESH_SECRET = REFRESH_SECRET;
