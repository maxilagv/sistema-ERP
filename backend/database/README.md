Database (PostgreSQL)

- Engine: PostgreSQL (detected via `backend/server/db/pg.js`).
- Files:
  - `backend/database/schema.sql`: full DDL (tables, constraints, indexes, views).
  - `backend/database/seed.sql`: minimal seed (roles) — optional.

How to apply

- Ensure a PostgreSQL server is running and you have a database created.
- Option A: use a connection string env var (recommended):
  - Example: `export DATABASE_URL=postgres://user:pass@localhost:5432/sg`
  - Then: `psql "$DATABASE_URL" -f backend/database/schema.sql`
- Option B: pass connection params directly to `psql`:
  - `psql -h localhost -U user -d sg -f backend/database/schema.sql`
- Seed (optional):
  - `psql "$DATABASE_URL" -f backend/database/seed.sql`

What’s included

- Normalized tables for: usuarios/roles/logs, clientes, proveedores, categorias,
  productos + imagenes, inventario, movimientos de stock (y ajustes), compras
  (+ detalle + recepciones), ventas (+ detalle), pagos, facturas, gastos,
  inversiones y configuracion.
- Strong referential integrity and `CHECK` constraints for enums and non-negative values.
- Indexes on frequent lookups and FKs; case-insensitive unique email for `usuarios`.
- Views:
  - `vista_deudas`: deuda por cliente = ventas.neto - pagos.
  - `vista_stock_bajo`: productos con stock por debajo del mínimo.
  - `vista_top_clientes`: ranking de clientes por monto comprado.
  - `vista_ganancias_mensuales`: ventas.neto por mes menos gastos por mes.
- `updated_at` trigger for common update timestamping.

Next steps / notes

- Create an admin user from the API or a manual `INSERT` with a secure `password_hash`.
- Consider adding application-level transactions to keep `inventario` in sync with
  `movimientos_stock` and sales/purchase flows.
- If you later support multi-empresa, we can extend with an `empresas` table and
  `empresa_id` FKs across core tables.

