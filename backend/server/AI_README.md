AI (Fase 1) - Endpoints y Configuración

Endpoints
- GET `/api/ai/forecast` Pronóstico por producto.
  - Query: `days` (def 14), `history` (def 90), `limit`, `stockTargetDays`.
- GET `/api/ai/stockouts` Riesgo de quiebre de stock.
  - Query: `days` (def 14), `history` (def 90), `limit`.
- GET `/api/ai/anomalias` Anomalías en ventas/gastos por z-score.
  - Query: `scope` (sales|expenses|both), `period` (def 90), `sigma` (def 3).
- GET `/api/ai/precios` Precios sugeridos por margen objetivo y rotación.
  - Query: `margin` (def 0.3), `history` (def 90), `limit`.

Variables de entorno (opcionales)
- `AI_STOCK_TARGET_DAYS` (def 30): dÃ­as de cobertura objetivo para sugerir reposiciÃ³n.
- `AI_ANOMALY_SIGMA` (def 3): sensibilidad del z-score.
- `PRICING_TARGET_MARGIN` (def 0.3): margen objetivo base.
- `AI_ROTATION_LOW_PER_DAY` (def 0.05) y `AI_ROTATION_HIGH_PER_DAY` (def 0.5): umbrales de rotación diaria.
- `AI_PRICING_UP_ADJ` (def 0.05) y `AI_PRICING_DOWN_ADJ` (def 0.05): ajustes por rotación.

Notas
- Los endpoints requieren autenticaciÃ³n JWT (middleware `auth`).
- Las consultas excluyen ventas con estado `cancelado`.
- El forecast inicial usa promedio diario simple sobre `history` dÃ­as.
