// Cargar variables de entorno desde el archivo .env
require('dotenv').config();

const express = require('express');
const app = express();

//  OBLIGATORIO – PRIMERO
app.set('trust proxy', true);

// --- recién acá importás el resto ---
const helmet = require('helmet');
const cors = require('cors');
const xss = require('xss-clean');
const compression = require('compression');
const path = require('path');

const {
  apiLimiter,
  apiGlobalLimiter,
  loggingMiddleware,
  pathTraversalProtection,
  sendSMSNotification,
} = require('./middlewares/security.js');

// Rutas
const authRoutes = require('./routes/authroutes.js');
const productRoutes = require('./routes/productroutes.js');
const categoryRoutes = require('./routes/categoryroutes.js');
const publicRoutes = require('./routes/publicroutes.js');
const healthRoutes = require('./routes/healthroutes.js');
const orderRoutes = require('./routes/orderroutes.js');
const reportRoutes = require('./routes/reportroutes.js');
const aiRoutes = require('./routes/airoutes.js');
const inventoryRoutes = require('./routes/inventarioroutes.js');
const userRoutes = require('./routes/userroutes.js');
const clientRoutes = require('./routes/clientroutes.js');
const supplierRoutes = require('./routes/supplierroutes.js');
const purchaseRoutes = require('./routes/purchaseroutes.js');
const salesRoutes = require('./routes/salesroutes.js');
const paymentRoutes = require('./routes/paymentroutes.js');
const crmRoutes = require('./routes/crmroutes.js');
const ticketRoutes = require('./routes/ticketroutes.js');
const approvalRoutes = require('./routes/approvalroutes.js');

const app = express();

// Confiar en el proxy (cuando se usa detrÃ¡s de CDN/Reverse Proxy)
app.set('trust proxy', 1);


// Puerto/host (localhost por defecto para uso local)
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';  // FIJO para Render, obligatorio


// Deshabilitar el encabezado X-Powered-By para mayor seguridad
app.disable('x-powered-by');

// Helmet bÃ¡sico + CSP (similar a index.js)
app.use(
  helmet({
    referrerPolicy: { policy: 'no-referrer' },
  })
);

const cspConnectSrc = (() => {
  const set = new Set([
    "'self'",
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:5501',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ]);
  const add = (v) => {
    if (v && typeof v === 'string') set.add(v.trim());
  };
  if (process.env.CORS_ALLOWED_ORIGINS) {
    process.env.CORS_ALLOWED_ORIGINS.split(',')
      .map((s) => s.trim())
      .forEach((origin) => {
        try {
          add(new URL(origin).origin);
        } catch (_) {}
      });
  }
  if (process.env.PUBLIC_ORIGIN) add(process.env.PUBLIC_ORIGIN);
  return Array.from(set);
})();

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://cdn.tailwindcss.com',
        'https://www.gstatic.com',
      ],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
      imgSrc: [
        "'self'",
        'data:',
        'https://placehold.co',
        'https://cdn.prod.website-files.com',
      ],
      connectSrc: cspConnectSrc,
      fontSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  })
);

// CORS con orÃ­genes locales por defecto
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean)
  : [
      'http://localhost:8080',
      'http://127.0.0.1:5500',
      'http://127.0.0.1:5501',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ];

function toRegex(pattern) {
  try {
    if (!pattern.includes('*')) return null;
    const escaped = pattern
      .replace(/[.]/g, '\\.')
      .replace(/[\/]/g, '\\/')
      .replace(/\*/g, '.*');
    return new RegExp('^' + escaped + '$', 'i');
  } catch {
    return null;
  }
}

const allowedOriginsSet = new Set();
const allowedOriginRegexps = [];
for (const o of allowedOrigins) {
  const rx = toRegex(o);
  if (rx) allowedOriginRegexps.push(rx);
  else allowedOriginsSet.add(o);
}

const corsAllowAll =
  process.env.CORS_ALLOW_ALL === 'true' ||
  process.env.CORS_ALLOWED_ORIGINS === '*';

app.use(
  cors({
    origin: corsAllowAll
      ? true
      : function (origin, callback) {
          if (!origin) return callback(null, true);
          if (allowedOriginsSet.has(origin)) {
            return callback(null, true);
          }
          if (allowedOriginRegexps.some((rx) => rx.test(origin))) {
            return callback(null, true);
          }
          if (process.env.NODE_ENV !== 'production') {
            console.error(`CORS: Origen no permitido: ${origin}`);
          }
          return callback(new Error('No permitido por CORS'));
        },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
    optionsSuccessStatus: 204,
  })
);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(compression({ threshold: '1kb' }));
app.use(xss());

// Asegurar req.query como objeto mutable
app.use((req, res, next) => {
  req.query = { ...req.query };
  next();
});

// ProtecciÃ³n contra poluciÃ³n de parÃ¡metros
app.use(require('hpp')());

// EstÃ¡ticos
app.use(
  express.static(path.join(__dirname, 'public'), {
    etag: true,
    lastModified: true,
    maxAge: process.env.STATIC_MAX_AGE || '7d',
    immutable: true,
  })
);

// Logging y protecciones
if (process.env.REQUEST_LOGGING !== 'off') {
  app.use(loggingMiddleware);
}
app.use(pathTraversalProtection);

// HTTPS forzado opcional
if (process.env.FORCE_HTTPS === 'true') {
  app.use((req, res, next) => {
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') return next();
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  });
}

// Rate limit global y rutas
app.use('/api', apiGlobalLimiter);
app.use('/api', healthRoutes);
app.use('/api', publicRoutes);
app.use('/api', authRoutes);
app.use('/api', productRoutes);
app.use('/api', categoryRoutes);
app.use('/api', orderRoutes);
app.use('/api', reportRoutes);
app.use('/api', aiRoutes);
app.use('/api', inventoryRoutes);
app.use('/api', userRoutes);
app.use('/api', clientRoutes);
app.use('/api', supplierRoutes);
app.use('/api', purchaseRoutes);
app.use('/api', salesRoutes);
app.use('/api', paymentRoutes);
app.use('/api', crmRoutes);
app.use('/api', ticketRoutes);
app.use('/api', approvalRoutes);

// Root
app.get('/', (req, res) => {
  res.send('Servidor local funcionando (localhost only)');
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.message === 'No permitido por CORS') {
    return res
      .status(403)
      .json({ error: 'Acceso denegado: Origen no permitido.' });
  }
  sendSMSNotification(
    `Alerta de error grave en servidor: ${err.message || 'Error desconocido'}. Ruta: ${req.originalUrl}`
  );
  res.status(500).json({
    error:
      'Algo salió mal en el servidor. Por favor, inténtalo de nuevo más tarde.',
  });
});

// Iniciar el servidor local enlazado a HOST/localhost
const server = app.listen(PORT, HOST, () => {
  console.log(`Servidor local escuchando en http://${HOST}:${PORT}`);
});

// Ajustes de keep-alive/headers timeout
const keepAliveMs = Number(process.env.KEEP_ALIVE_TIMEOUT_MS || 65000);
const headersTimeoutMs = Number(process.env.HEADERS_TIMEOUT_MS || 66000);
server.keepAliveTimeout = keepAliveMs;
server.headersTimeout = headersTimeoutMs;

module.exports = app;
