# Deploy Render - Fase 5

## Variables criticas

Configura estas variables en Render para evitar errores de arranque:

- `NODE_ENV=production`
- `TRUST_PROXY=true`
- `DATABASE_URL=...`
- `JWT_SECRET=...`
- `REFRESH_TOKEN_SECRET=...`
- `ACCESS_TOKEN_HASH_SECRET=...`
- `REFRESH_TOKEN_HASH_SECRET=...`
- `CORS_ALLOWED_ORIGINS=https://tu-frontend.example.com`
- `PUBLIC_ORIGIN=https://tu-frontend.example.com`

## Comando de build y start

- Build: `npm install`
- Start: `npm start`

La app del backend arranca con `node index.js` desde `backend/server`.

## Migraciones

Antes de habilitar trafico productivo, ejecutar:

1. `npm run migrate`
2. Verificar que exista la migracion `V28__alarmas_promociones_carrito_cliente.sql`

## Smoke test post deploy

1. `GET /api/health` responde 200.
2. Login admin funciona y refresco de token funciona.
3. `GET /api/finanzas/ganancia-bruta` responde con token admin.
4. `GET /api/finanzas/ingresos-brutos-productos` responde con token admin.
5. `POST /api/finanzas/presupuestos` crea/actualiza un item.
6. `DELETE /api/finanzas/presupuestos/:id` elimina el item.
7. `POST /api/finanzas/simulador` responde escenario actual/simulado.
8. `POST /api/alarmas/evaluar` y `POST /api/alarmas/procesar-cola` responden 200.
9. Login cliente funciona y `GET /api/cliente/carrito` responde.
10. Checkout cliente (`POST /api/cliente/carrito/checkout`) genera venta.

## Observabilidad minima recomendada

- Alertar cuando `GET /api/health` falle 2 chequeos seguidos.
- Alertar por aumento de `5xx` en ventana de 5 minutos.
- Revisar cola de notificaciones de alarmas diariamente.
