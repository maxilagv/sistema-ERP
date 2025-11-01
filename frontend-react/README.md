Frontend (React + Vite)

Resumen técnico
- Framework: React 18 + TypeScript (Vite)
- Estilos: TailwindCSS (tokens extendidos), tema oscuro/claro con ThemeContext
- Animaciones: Framer Motion para transiciones, microinteracciones y efectos decorativos
- Gráficos: Recharts (tema oscuro con gradientes)
- Iconografía: lucide-react

Estructura de carpetas (src/)
- components: piezas reutilizables (Alert, Logo, Spinner, StatCard heredado)
- context: AuthContext (manejo de tokens) y ThemeContext (tema claro/oscuro)
- layout: contenedores de layout (Navbar, Sidebar, Layout)
- lib: utilidades de dominio (api.ts, storage.ts)
- pages: vistas de aplicación (Login, Dashboard, Clientes, Productos, Categorias, etc.)
- routes: enrutador principal y protección de rutas (AppRouter)
- styles: estilos globales Tailwind + utilidades (glass, neon, skeleton)
- ui: UI kit local (Button, Card, MetricCard, ChartCard, DataTable, Skeleton, AnimatedOrbs)
- config, types: constantes y tipos de apoyo

Funcionamiento
- Enrutamiento: `AppRouter` organiza rutas públicas (Login) y privadas (`/app/*`) con un wrapper `Protected` que consulta `AuthContext`.
- Autenticación: `AuthContext` persiste tokens; `lib/api.ts` implementa `apiFetch` con cabecera Bearer y flujo de refresh 401→POST `/api/refresh-token`.
- Theming: `ThemeContext` aplica/remueve la clase `dark` en `documentElement` y persiste la preferencia en `localStorage`.
- Estética: tokens (indigo/cian), glassmorphism y fondos neon. Login con orbes animados (AnimatedOrbs) y efectos “scanlines/grid-sweep”.

Configuración
- Variables de entorno (no incluir credenciales en repositorio):
  - `VITE_API_BASE_URL` (opcional en desarrollo si se usa proxy)
- Vite proxy: `vite.config.ts` enruta `/api` → `http://127.0.0.1:3000` en desarrollo.

Comandos
- Desarrollo: `npm install && npm run dev`
- Construcción: `npm run build` (salida en `dist/`)
- Previsualización estática: `npm run preview`

Notas de seguridad
- No subir `.env` ni tokens; el `.gitignore` ignora `.env` y derivados.
- Validaciones de inputs y estados de carga sugeridos con skeletons y `react-query` (opcional).

