Servidor (Node.js + Express)

Resumen tecnico
- Runtime: Node.js + Express
- Seguridad: Helmet (CSP), CORS configurable, HPP, xss-clean, compresion
- Base de datos: PostgreSQL (pg) con repositorios por entidad
- Autenticacion: JWT (access/refresh) con refresh tokens hasheados, blacklist persistida en DB
- Limitacion de tasa: rate-limits globales y por rutas de autenticacion

Estructura
- index.js: configuracion de app (CSP, CORS, middlewares), carga de rutas bajo `/api`, arranque del servidor.
- routes/: definicion de endpoints (auth, productos, categorias, clientes, etc.).
- controllers/: logica de entrada/salida HTTP; delega a repositorios.
- db/pg.js: pool de conexion y helpers de transacciones.
- db/repositories/: consultas SQL por dominio (usuarios, productos, categorias, clientes, tokens, etc.).
- middlewares/: autenticacion JWT, control de roles, seguridad y rate-limits.
- utils/: helpers varios (mailer para 2FA, si corresponde).

Base de datos
- Esquema principal en `backend/database/schema.sql` (usuarios, roles, productos, categorias, inventario, ventas, pagos, etc.).
- Semillas basicas en `backend/database/seed.sql` (roles) y migraciones en `backend/database/migrations` (auth_refresh_tokens, jwt_blacklist).

Autenticacion y autorizacion
- Login: `POST /api/login` valida credenciales y entrega access/refresh tokens.
- Refresh: `POST /api/refresh-token` valida refresh token hasheado, revoca el anterior y entrega nuevos tokens.
- Logout: `POST /api/logout` revoca refresh token y agrega access token a blacklist persistida.
- Autorizacion por rol: middleware `requireRole([...])` aplicado en rutas criticas (p. ej. categorias, productos, usuarios).

Endpoints principales (resumen)
- `GET /api/productos` (publico lectura), `POST/PUT/DELETE /api/productos` (admin/gerente).
- `GET /api/categorias` (publico lectura), `POST/PUT/DELETE /api/categorias` (admin/gerente; delete admin).
- `GET /api/clientes` (autenticado), `POST/PUT /api/clientes` (admin/gerente/vendedor).
- `POST /api/login`, `POST /api/refresh-token`, `POST /api/logout`.

Variables de entorno (no incluir valores en el repositorio)
- JWT/seguridad: `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `ACCESS_TOKEN_HASH_SECRET`, `REFRESH_TOKEN_HASH_SECRET`, `JWT_ALG`, `JWT_ISSUER`, `JWT_AUDIENCE`.
- Binding refresh token (opcional): `REFRESH_TOKEN_BIND_UA`, `REFRESH_TOKEN_BIND_IP`.
- Respuesta de password en texto plano (solo dev): `ALLOW_PLAINTEXT_PASSWORD_RESPONSE`.
- CORS/CSP: `CORS_ALLOWED_ORIGINS`, `PUBLIC_ORIGIN`, `TRUST_PROXY`, `FORCE_HTTPS`.
- PostgreSQL: `DATABASE_URL` o `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `PGSSL`.
- SMTP (opcional 2FA): `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL`.

Puesta en marcha local
1) Crear base de datos PostgreSQL.
2) Aplicar esquema y semillas:
   - `psql "$DATABASE_URL" -f backend/database/schema.sql`
   - `psql "$DATABASE_URL" -f backend/database/seed.sql`
   - (Opcional) aplicar migraciones de `database/migrations`.
3) Configurar variables de entorno en `backend/server/.env` (no versionar; usar `.env.example` como base).
4) Instalar y ejecutar:
   - `cd backend/server`
   - `npm install`
   - `npm run dev`

Consideraciones
- El servidor asume que el frontend de desarrollo (Vite) hace proxy de `/api` a `127.0.0.1:3000`.
- `.gitignore` excluye `.env` y artefactos de compilacion/coverage.
