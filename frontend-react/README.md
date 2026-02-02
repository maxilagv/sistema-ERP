Frontend (React + Vite)

Resumen tecnico
- Framework: React 18 + TypeScript (Vite)
- Estilos: TailwindCSS (tokens extendidos), tema oscuro/claro con ThemeContext
- Animaciones: Framer Motion para transiciones, microinteracciones y efectos decorativos
- Graficos: Recharts (tema oscuro con gradientes)
- Iconografia: lucide-react

Estructura de carpetas (src/)
- components: piezas reutilizables (Alert, Logo, Spinner, StatCard heredado)
- context: AuthContext (manejo de tokens) y ThemeContext (tema claro/oscuro)
- layout: contenedores de layout (Navbar, Sidebar, Layout)
- lib: utilidades de dominio (api.ts, storage.ts)
- pages: vistas de aplicacion (Login, Dashboard, Clientes, Productos, Categorias, etc.)
- routes: enrutador principal y proteccion de rutas (AppRouter)
- styles: estilos globales Tailwind + utilidades (glass, neon, skeleton)
- ui: UI kit local (Button, Card, MetricCard, ChartCard, DataTable, Skeleton, AnimatedOrbs)
- config, types: constantes y tipos de apoyo

Funcionamiento
- Enrutamiento: `AppRouter` organiza rutas publicas (Login) y privadas (`/app/*`) con un wrapper `Protected` que consulta `AuthContext`.
- Autenticacion: `AuthContext` persiste tokens; `lib/api.ts` implementa `apiFetch` con cabecera Bearer y flujo de refresh 401 -> `POST /api/refresh-token`.
- Theming: `ThemeContext` aplica/remueve la clase `dark` en `documentElement` y persiste la preferencia en `localStorage`.

Configuracion
- Variables de entorno (no incluir credenciales en repositorio):
  - `VITE_API_BASE_URL` (opcional en desarrollo si se usa proxy)
  - `VITE_AI_LLM_ENABLED` (true/false)

Comandos
- Desarrollo: `npm install && npm run dev`
- Construccion: `npm run build` (salida en `dist/`)
- Previsualizacion estatica: `npm run preview`
