import { useEffect, useState } from 'react';
import ChartCard from '../ui/ChartCard';
import DataTable from '../ui/DataTable';
import { Api } from '../lib/api';

type ForecastRow = { producto_id: number; producto_nombre: string; daily_avg: number; forecast_units: number; disponible: number; cobertura_dias: number; sugerido_reponer: number };
type StockoutRow = ForecastRow & { dias_hasta_quiebre: number };
type PrecioRow = { producto_id: number; producto_nombre: string; precio_actual: number; precio_sugerido: number; diferencia: number; margen_estimado: number | null; rotacion_diaria: number };

export default function Predicciones() {
  const [forecast, setForecast] = useState<ForecastRow[]>([]);
  const [stockouts, setStockouts] = useState<StockoutRow[]>([]);
  const [anomSales, setAnomSales] = useState<{ dia: string; total: number; z: number; tipo: string }[]>([]);
  const [precios, setPrecios] = useState<PrecioRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [f, s, a, p] = await Promise.all([
          Api.aiForecast({ days: 14, history: 90, limit: 50 }),
          Api.aiStockouts({ days: 14, history: 90, limit: 50 }),
          Api.aiAnomalias({ scope: 'sales', period: 90, sigma: 3 }),
          Api.aiPrecios({ history: 90, limit: 50 }),
        ]);
        setForecast(f || []);
        setStockouts(s || []);
        setAnomSales((a?.sales || []).map((r: any) => ({ ...r, dia: r.dia })));
        setPrecios(p || []);
      } catch (_) {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Pronóstico por producto (14 días)">
          <DataTable
            headers={
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="py-2 px-2">Producto</th>
                  <th className="py-2 px-2">Rotación diaria</th>
                  <th className="py-2 px-2">Disponible</th>
                  <th className="py-2 px-2">Cobertura (días)</th>
                  <th className="py-2 px-2">Sugerido reponer</th>
                </tr>
              </thead>
            }
          >
            <tbody className="text-slate-200">
              {(loading ? [] : forecast).map((r) => (
                <tr key={r.producto_id} className="border-t border-white/10 hover:bg-white/5">
                  <td className="py-2 px-2">{r.producto_nombre}</td>
                  <td className="py-2 px-2">{r.daily_avg.toFixed(3)}</td>
                  <td className="py-2 px-2">{r.disponible}</td>
                  <td className="py-2 px-2">{r.cobertura_dias}</td>
                  <td className="py-2 px-2">{r.sugerido_reponer}</td>
                </tr>
              ))}
              {!loading && forecast.length === 0 && (
                <tr><td className="py-3 px-2 text-slate-400" colSpan={5}>Sin datos</td></tr>
              )}
            </tbody>
          </DataTable>
        </ChartCard>
        <ChartCard title="Riesgo de stockout (próx. 14 días)">
          <DataTable
            headers={
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="py-2 px-2">Producto</th>
                  <th className="py-2 px-2">Disponible</th>
                  <th className="py-2 px-2">Rotación diaria</th>
                  <th className="py-2 px-2">Días hasta quiebre</th>
                  <th className="py-2 px-2">Sugerido reponer</th>
                </tr>
              </thead>
            }
          >
            <tbody className="text-slate-200">
              {(loading ? [] : stockouts).map((r) => (
                <tr key={r.producto_id} className="border-t border-white/10 hover:bg-white/5">
                  <td className="py-2 px-2">{r.producto_nombre}</td>
                  <td className="py-2 px-2">{r.disponible}</td>
                  <td className="py-2 px-2">{r.daily_avg.toFixed(3)}</td>
                  <td className="py-2 px-2">{r.dias_hasta_quiebre}</td>
                  <td className="py-2 px-2">{r.sugerido_reponer}</td>
                </tr>
              ))}
              {!loading && stockouts.length === 0 && (
                <tr><td className="py-3 px-2 text-slate-400" colSpan={5}>Sin riesgos detectados</td></tr>
              )}
            </tbody>
          </DataTable>
        </ChartCard>
      </div>

      <ChartCard title="Anomalías en ventas (90 días)">
        <DataTable
          headers={
            <thead className="text-left text-slate-400">
              <tr>
                <th className="py-2 px-2">Fecha</th>
                <th className="py-2 px-2">Total</th>
                <th className="py-2 px-2">Z-score</th>
                <th className="py-2 px-2">Tipo</th>
              </tr>
            </thead>
          }
        >
          <tbody className="text-slate-200">
            {(loading ? [] : anomSales).map((r, i) => (
              <tr key={i} className="border-t border-white/10 hover:bg-white/5">
                <td className="py-2 px-2">{new Date(r.dia).toLocaleDateString()}</td>
                <td className="py-2 px-2">{"$" + r.total.toFixed(0)}</td>
                <td className="py-2 px-2">{r.z}</td>
                <td className="py-2 px-2">{r.tipo}</td>
              </tr>
            ))}
            {!loading && anomSales.length === 0 && (
              <tr><td className="py-3 px-2 text-slate-400" colSpan={4}>Sin anomalías significativas</td></tr>
            )}
          </tbody>
        </DataTable>
      </ChartCard>

      <ChartCard title="Precios sugeridos">
        <DataTable
          headers={
            <thead className="text-left text-slate-400">
              <tr>
                <th className="py-2 px-2">Producto</th>
                <th className="py-2 px-2">Precio actual</th>
                <th className="py-2 px-2">Sugerido</th>
                <th className="py-2 px-2">Diferencia</th>
                <th className="py-2 px-2">Margen est.</th>
                <th className="py-2 px-2">Rotación diaria</th>
              </tr>
            </thead>
          }
        >
          <tbody className="text-slate-200">
            {(loading ? [] : precios).map((r) => (
              <tr key={r.producto_id} className="border-t border-white/10 hover:bg-white/5">
                <td className="py-2 px-2">{r.producto_nombre}</td>
                <td className="py-2 px-2">{"$" + r.precio_actual.toFixed(2)}</td>
                <td className="py-2 px-2">{"$" + r.precio_sugerido.toFixed(2)}</td>
                <td className="py-2 px-2">{(r.diferencia > 0 ? "+$" : "-$") + Math.abs(r.diferencia).toFixed(2)}</td>
                <td className="py-2 px-2">{r.margen_estimado != null ? (r.margen_estimado * 100).toFixed(1) + "%" : '-'}</td>
                <td className="py-2 px-2">{r.rotacion_diaria.toFixed(3)}</td>
              </tr>
            ))}
            {!loading && precios.length === 0 && (
              <tr><td className="py-3 px-2 text-slate-400" colSpan={6}>Sin sugerencias de precio</td></tr>
            )}
          </tbody>
        </DataTable>
      </ChartCard>
    </div>
  );
}
