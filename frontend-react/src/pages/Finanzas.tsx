import { useEffect, useMemo, useState } from 'react';
import { Api } from '../lib/api';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';

type PeriodKey = '24h' | '7d' | '30d' | 'custom';
type TabKey = 'costos' | 'bruta' | 'neta' | 'producto';

type SerieGananciaNeta = {
  fecha: string;
  totalVentas: number;
  totalCostoProductos: number;
  totalGastos: number;
  totalInversiones: number;
  gananciaBruta: number;
  gananciaNeta: number;
};

type SerieGananciaBruta = {
  fecha: string;
  totalVentas: number;
};

type DetalleGananciaPorProducto = {
  productoId: number;
  productoCodigo: string;
  productoNombre: string;
  unidadesVendidas: number;
  ingresos: number;
  costoTotal: number;
  gananciaBruta: number;
  margenPorcentaje: number | null;
};

type DetalleCostosProducto = {
  productoId: number;
  productoCodigo: string;
  productoNombre: string;
  moneda: string;
  cantidad: number;
  totalCostos: number;
};

function computeRange(period: PeriodKey, desde: string, hasta: string): { desde: string; hasta: string } | null {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  if (period === '24h') {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return { desde: d.toISOString().slice(0, 10), hasta: todayStr };
  }
  if (period === '7d') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { desde: d.toISOString().slice(0, 10), hasta: todayStr };
  }
  if (period === '30d') {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    return { desde: d.toISOString().slice(0, 10), hasta: todayStr };
  }
  if (!desde || !hasta) return null;
  return { desde, hasta };
}

export default function Finanzas() {
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [customDesde, setCustomDesde] = useState<string>('');
  const [customHasta, setCustomHasta] = useState<string>('');
  const [tab, setTab] = useState<TabKey>('neta');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [serieNeta, setSerieNeta] = useState<SerieGananciaNeta[]>([]);
  const [serieBruta, setSerieBruta] = useState<SerieGananciaBruta[]>([]);
  const [productosRentables, setProductosRentables] = useState<DetalleGananciaPorProducto[]>([]);
  const [costosProductos, setCostosProductos] = useState<DetalleCostosProducto[]>([]);

  const range = useMemo(() => computeRange(period, customDesde, customHasta), [period, customDesde, customHasta]);

  useEffect(() => {
    if (!range) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [netaRes, brutaRes, prodRes, costosRes] = await Promise.all([
          Api.gananciaNeta({ desde: range.desde, hasta: range.hasta }),
          Api.gananciaBruta({ desde: range.desde, hasta: range.hasta, agregado: 'dia' }),
          Api.gananciaPorProducto({ desde: range.desde, hasta: range.hasta, limit: 20, orderBy: 'ganancia' }),
          Api.costosProductos({ desde: range.desde, hasta: range.hasta, groupBy: 'producto' }),
        ]);

        setSerieNeta(
          (netaRes?.serie || []).map((r: any) => ({
            fecha: r.fecha,
            totalVentas: Number(r.totalVentas || 0),
            totalCostoProductos: Number(r.totalCostoProductos || 0),
            totalGastos: Number(r.totalGastos || 0),
            totalInversiones: Number(r.totalInversiones || 0),
            gananciaBruta: Number(r.gananciaBruta || 0),
            gananciaNeta: Number(r.gananciaNeta || 0),
          }))
        );

        setSerieBruta(
          (brutaRes?.serie || []).map((r: any) => ({
            fecha: r.fecha,
            totalVentas: Number(r.totalVentas || 0),
          }))
        );

        setProductosRentables(
          (prodRes?.items || []).map((r: any) => ({
            productoId: r.productoId,
            productoCodigo: r.productoCodigo,
            productoNombre: r.productoNombre,
            unidadesVendidas: Number(r.unidadesVendidas || 0),
            ingresos: Number(r.ingresos || 0),
            costoTotal: Number(r.costoTotal || 0),
            gananciaBruta: Number(r.gananciaBruta || 0),
            margenPorcentaje: r.margenPorcentaje != null ? Number(r.margenPorcentaje) : null,
          }))
        );

        setCostosProductos(
          (costosRes?.detalles || []).map((r: any) => ({
            productoId: r.productoId,
            productoCodigo: r.productoCodigo,
            productoNombre: r.productoNombre,
            moneda: r.moneda,
            cantidad: Number(r.cantidad || 0),
            totalCostos: Number(r.totalCostos || 0),
          }))
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudieron cargar los datos de finanzas');
        setSerieNeta([]);
        setSerieBruta([]);
        setProductosRentables([]);
        setCostosProductos([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [range?.desde, range?.hasta]);

  const chartGananciaNeta = useMemo(
    () =>
      serieNeta.map((r) => ({
        fecha: new Date(r.fecha).toLocaleDateString(undefined, { month: 'short', day: '2-digit' }),
        ventas: r.totalVentas,
        costo: r.totalCostoProductos,
        gastos: r.totalGastos + r.totalInversiones,
        neta: r.gananciaNeta,
      })),
    [serieNeta]
  );

  const chartGananciaBruta = useMemo(
    () =>
      serieBruta.map((r) => ({
        fecha: new Date(r.fecha).toLocaleDateString(undefined, { month: 'short', day: '2-digit' }),
        ventas: r.totalVentas,
      })),
    [serieBruta]
  );

  const totalGananciaNeta = useMemo(
    () => serieNeta.reduce((acc, r) => acc + r.gananciaNeta, 0),
    [serieNeta]
  );

  const totalCostosPeriodo = useMemo(
    () => costosProductos.reduce((acc, r) => acc + r.totalCostos, 0),
    [costosProductos]
  );

  const topProducto = useMemo(() => productosRentables[0] ?? null, [productosRentables]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Finanzas</h2>
          {range && (
            <p className="text-xs text-slate-500 mt-1">
              Período: {range.desde} a {range.hasta}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="text-sm rounded-md border border-slate-300 bg-white dark:bg-slate-900 px-2 py-1"
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodKey)}
          >
            <option value="24h">Últimas 24h</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="custom">Personalizado</option>
          </select>
          {period === 'custom' && (
            <>
              <input
                type="date"
                className="text-sm rounded-md border border-slate-300 bg-white dark:bg-slate-900 px-2 py-1"
                value={customDesde}
                onChange={(e) => setCustomDesde(e.target.value)}
              />
              <input
                type="date"
                className="text-sm rounded-md border border-slate-300 bg-white dark:bg-slate-900 px-2 py-1"
                value={customHasta}
                onChange={(e) => setCustomHasta(e.target.value)}
              />
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4">
          <div className="text-xs text-slate-500 mb-1">Ganancia neta del período</div>
          <div className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
            ${totalGananciaNeta.toFixed(0)}
          </div>
        </div>
        <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4">
          <div className="text-xs text-slate-500 mb-1">Costos de productos (total)</div>
          <div className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
            ${totalCostosPeriodo.toFixed(0)}
          </div>
        </div>
        <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4">
          <div className="text-xs text-slate-500 mb-1">Producto más rentable</div>
          {topProducto ? (
            <div>
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {topProducto.productoNombre}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Ganancia bruta: ${topProducto.gananciaBruta.toFixed(0)}{' '}
                {topProducto.margenPorcentaje != null && `(${topProducto.margenPorcentaje.toFixed(1)}%)`}
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500">Sin datos en el período</div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-700">
        {[
          { key: 'costos', label: 'Costos de productos' },
          { key: 'bruta', label: 'Ganancia bruta' },
          { key: 'neta', label: 'Ganancia neta' },
          { key: 'producto', label: 'Ganancia por producto' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${
              tab === (t.key as TabKey)
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setTab(t.key as TabKey)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'neta' && (
        <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4">
          <div className="text-sm text-slate-500 mb-2">Ganancias brutas vs. netas</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartGananciaNeta}>
                <XAxis dataKey="fecha" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="ventas"
                  stroke="#4f46e5"
                  fill="#6366f1"
                  fillOpacity={0.25}
                  name="Ventas"
                />
                <Area
                  type="monotone"
                  dataKey="neta"
                  stroke="#06b6d4"
                  fill="#22d3ee"
                  fillOpacity={0.25}
                  name="Ganancia neta"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === 'bruta' && (
        <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4">
          <div className="text-sm text-slate-500 mb-2">Ingresos por ventas</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartGananciaBruta}>
                <XAxis dataKey="fecha" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="ventas"
                  stroke="#4f46e5"
                  fill="#6366f1"
                  fillOpacity={0.25}
                  name="Ventas"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === 'costos' && (
        <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4">
          <div className="text-sm text-slate-500 mb-2">Costos de productos por artículo</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2 px-2">Código</th>
                  <th className="py-2 px-2">Producto</th>
                  <th className="py-2 px-2 text-right">Cantidad</th>
                  <th className="py-2 px-2 text-right">Costo total</th>
                  <th className="py-2 px-2">Moneda</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-200">
                {costosProductos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-500">
                      Sin movimientos de compras en el período.
                    </td>
                  </tr>
                )}
                {costosProductos.map((r) => (
                  <tr key={r.productoId} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-2 px-2">{r.productoCodigo}</td>
                    <td className="py-2 px-2">{r.productoNombre}</td>
                    <td className="py-2 px-2 text-right">{r.cantidad}</td>
                    <td className="py-2 px-2 text-right">
                      {r.totalCostos.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 px-2">{r.moneda}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'producto' && (
        <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4">
          <div className="text-sm text-slate-500 mb-2">Top productos por ganancia bruta</div>
          <div className="h-72 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={productosRentables.map((p) => ({
                  nombre: p.productoNombre,
                  ganancia: p.gananciaBruta,
                }))}
                margin={{ left: 0, right: 0 }}
              >
                <XAxis dataKey="nombre" hide />
                <YAxis />
                <Tooltip />
                <Bar dataKey="ganancia" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2 px-2">Código</th>
                  <th className="py-2 px-2">Producto</th>
                  <th className="py-2 px-2 text-right">Unidades</th>
                  <th className="py-2 px-2 text-right">Ingresos</th>
                  <th className="py-2 px-2 text-right">Costo</th>
                  <th className="py-2 px-2 text-right">Ganancia</th>
                  <th className="py-2 px-2 text-right">Margen %</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-200">
                {productosRentables.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-slate-500">
                      Sin ventas en el período.
                    </td>
                  </tr>
                )}
                {productosRentables.map((p) => (
                  <tr key={p.productoId} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-2 px-2">{p.productoCodigo}</td>
                    <td className="py-2 px-2">{p.productoNombre}</td>
                    <td className="py-2 px-2 text-right">{p.unidadesVendidas}</td>
                    <td className="py-2 px-2 text-right">
                      {p.ingresos.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {p.costoTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {p.gananciaBruta.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {p.margenPorcentaje != null ? `${p.margenPorcentaje.toFixed(1)}%` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-xs text-slate-500">
          Cargando datos financieros...
        </div>
      )}
    </div>
  );
}

