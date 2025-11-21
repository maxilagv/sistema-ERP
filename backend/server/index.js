// ==============================
//   CARGA DE VARIABLES ENV
// ==============================
require('dotenv').config();

const express = require('express');
const app = express();

// ==============================
//   🔥 TRUST PROXY — OBLIGATORIO EN RENDER
// ==============================
// Debe ser la PRIMERA configuración de express
app.set('trust proxy', true);

// ==============================
//   IMPORTS DE MIDDLEWARES
// ==============================
const helmet = require('helmet');
const cors = require('cors');
const xss = require('xss-clean');
const compression = require('compression');
const path = require('path');
const hpp = require('hpp');

const {
  apiLimiter,
  apiGlobalLimiter,
  loggingMiddleware,
  pathTraversalProtection,
  sendSMSNotification,
} = require('./middlewares/security.js');

// ==============================
//   IMPORT DE RUTAS
// ==============================
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

// ==============================
//   CONFIG SERVER
// ==============================
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Necesario para Render

app.disable('x-powered-by');

// ==============================
//   HELMET + CSP
// ==============================
const cspConnectSrc = (() => {
  const set = new Set([
    "'self'",
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ]);

  if (process.env.CORS_ALLOWED_ORIGINS) {
    process.env.CORS_ALLOWED_ORIGINS.split(',')
      .map((o) => o.trim())
      .forEach((origin) => {
        try {
          set.add(new URL(origin).origin);
        } catch {}
      });
  }

  if (process.env.PUBLIC_ORIGIN) {
    try {
      set.add(new URL(process.env.PUBLIC_ORIGIN).origin);
    } catch {}
  }

  return Array.from(set);
})();

app.use(
  helmet({
    referrerPolicy: { policy: 'no-referrer' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "https://placehold.co"],
        connectSrc: cspConnectSrc,
        fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
        objectSrc: ["'none'"],
      },
    },
  })
);

// ==============================
//   CORS CONFIG
// ==============================
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : [];

const corsAllowAll =
  process.env.CORS_ALLOW_ALL === 'true' ||
  process.env.CORS_ALLOWED_ORIGINS === '*';

app.use(
  cors({
    origin: corsAllowAll ? true : allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
    optionsSuccessStatus: 204,
  })
);

// ==============================
//   MIDDLEWARES BASE
// ==============================
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(compression({ threshold: '1kb' }));
app.use(xss());
app.use(hpp());

// ==============================
//   LOG + PROTECCIÓN PATH TRAVERSAL
// ==============================
app.use(loggingMiddleware);
app.use(pathTraversalProtection);

// ==============================
//   GLOBAL RATE LIMIT ANTES DE RUTAS
// ==============================
app.use('/api', apiGlobalLimiter);

// ==============================
//   ARCHIVOS ESTÁTICOS
// ==============================
app.use(
  express.static(path.join(__dirname, 'public'), {
    etag: true,
    lastModified: true,
    maxAge: '7d',
    immutable: true,
  })
);

// ==============================
//   TODAS LAS RUTAS
// ==============================
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

// ==============================
//   RUTA DEFAULT
// ==============================
app.get('/', (req, res) => {
  res.send('Servidor funcionando en Render');
});

// ==============================
//   ERROR HANDLER
// ==============================
app.use((err, req, res, next) => {
  console.error(err.stack);

  if (err.message === 'No permitido por CORS') {
    return res.status(403).json({ error: 'Origen no permitido' });
  }

  sendSMSNotification(
    `Error grave en servidor: ${err.message}. Ruta: ${req.originalUrl}`
  );

  return res.status(500).json({ error: 'Error interno del servidor' });
});

// ==============================
//   START SERVER
// ==============================
const server = app.listen(PORT, HOST, () => {
  console.log(`Servidor escuchando en http://${HOST}:${PORT}`);
});

// Keep alive para Render
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

module.exports = app;

