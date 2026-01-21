import { useEffect, useMemo, useState } from 'react';
import { Users, Package, DollarSign, AlertTriangle, Printer } from 'lucide-react';
import { motion } from 'framer-motion';
import MetricCard from '../ui/MetricCard';
import ChartCard from '../ui/ChartCard';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Api } from '../lib/api';

type PeriodKey = 'today' | '7d' | '30d' | 'custom';
type ChartKind = 'line' | 'bar' | 'area';

type MovimientoFinanciero = {
  fecha: string;
  totalVentas: number;
  totalGastos: number;
  gananciaNeta: number;
};

type Operacion = {
  fecha: string;
  tipo: string;
  detalle: string;
  monto: number;
};

export default function Dashboard() {
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [customDesde, setCustomDesde] = useState<string>('');
  const [customHasta, setCustomHasta] = useState<string>('');
  const [chartType, setChartType] = useState<ChartKind>('line');

  const [movimientos, setMovimientos] = useState<MovimientoFinanciero[]>([]);
  const [movLoading, setMovLoading] = useState<boolean>(true);
  const [movError, setMovError] = useState<string | null>(null);

  const [deudas, setDeudas] = useState<number>(0);
  const [clientesCount, setClientesCount] = useState<number>(0);
  const [stockItems, setStockItems] = useState<number>(0);
  const [stockouts, setStockouts] = useState<any[]>([]);
  const [anomalias, setAnomalias] = useState<any[]>([]);

  const [ops, setOps] = useState<Operacion[]>([]);
  const [opsLoading, setOpsLoading] = useState<boolean>(true);
  const [opsError, setOpsError] = useState<string | null>(null);

  function computeRange(p: PeriodKey, desde: string, hasta: string): { desde: string; hasta: string } | null {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    if (p === 'today') {
      return { desde: todayStr, hasta: todayStr };
    }
    if (p === '7d') {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      return { desde: d.toISOString().slice(0, 10), hasta: todayStr };
    }
    if (p === '30d') {
      const d = new Date(today);
      d.setDate(d.getDate() - 29);
      return { desde: d.toISOString().slice(0, 10), hasta: todayStr };
    }
    if (!desde || !hasta) return null;
    return { desde, hasta };
  }

  useEffect(() => {
    (async () => {
      try {
        const [d, c, inv, so, an, ventas, compras] = await Promise.all([
          Api.deudas(),
          Api.clientes({ estado: 'activo', limit: 50000 }),
          Api.inventario(),
          Api.aiStockouts({ days: 14, history: 90, limit: 10 }),
          Api.aiAnomalias({ scope: 'sales', period: 90, sigma: 3 }),
          Api.ventas(),
          Api.compras(),
        ]);
        setDeudas(d.reduce((acc: number, r: any) => acc + Number(r.deuda_pendiente || 0), 0));
        setClientesCount(c.length);
        setStockItems(inv.reduce((acc: number, r: any) => acc + Number(r.cantidad_disponible || 0), 0));
        setStockouts((so || []).slice(0, 5));
        setAnomalias(((an?.sales) || []).slice(0, 5));

        const opsList: Operacion[] = [];
        (ventas || []).filter((v: any) => !v.oculto).forEach((v: any) => {
          opsList.push({
            fecha: v.fecha,
            tipo: 'Venta',
            detalle: v.cliente_nombre ? `Venta a ${v.cliente_nombre}` : `Venta #${v.id}`,
            monto: Number(v.neto ?? v.total ?? 0),
          });
        });
        (compras || []).forEach((cRow: any) => {
          opsList.push({
            fecha: cRow.fecha,
            tipo: 'Compra',
            detalle: cRow.proveedor_nombre ? `Compra a ${cRow.proveedor_nombre}` : `Compra #${cRow.id}`,
            monto: Number(cRow.total_costo ?? 0),
          });
        });
        opsList.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
        setOps(opsList.slice(0, 5));
      } catch (e) {
        setOpsError('No se pudieron cargar métricas y operaciones');
      } finally {
        setOpsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const range = computeRange(period, customDesde, customHasta);
      if (!range) {
        setMovimientos([]);
        return;
      }
      setMovLoading(true);
      setMovError(null);
      try {
        const data = await Api.movimientosFinancieros({ ...range, agregado: 'dia' });
        setMovimientos((data || []).map((r: any) => ({
          fecha: r.fecha,
          totalVentas: Number(r.totalVentas || 0),
          totalGastos: Number(r.totalGastos || 0),
          gananciaNeta: Number(r.gananciaNeta || 0),
        })));
      } catch (e) {
        setMovError('No se pudieron obtener datos');
        setMovimientos([]);
      } finally {
        setMovLoading(false);
      }
    })();
  }, [period, customDesde, customHasta]);

  const chartData = useMemo(
    () =>
      movimientos.map((r) => ({
        label: new Date(r.fecha).toLocaleDateString(undefined, { month: 'short', day: '2-digit' }),
        ventas: r.totalVentas,
        gastos: r.totalGastos,
        neto: r.gananciaNeta,
      })),
    [movimientos]
  );

  const gananciaPeriodo = useMemo(
    () => movimientos.reduce((acc, r) => acc + r.gananciaNeta, 0),
    [movimientos]
  );

  const canPrint =
    !movLoading &&
    !!computeRange(period, customDesde, customHasta);

  async function handlePrint() {
    const range = computeRange(period, customDesde, customHasta);
    if (!range) return;
    try {
      const blob = await Api.descargarInformeGanancias({ ...range, agregado: 'dia' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      // En un futuro se puede mostrar un toast de error
    }
  }

  return (
    <div className="space-y-6">
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        initial="hidden"
        animate="show"
        variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } }}
      >
        {[
          { t: 'Total clientes', v: clientesCount, i: <Users size={22} /> },
          { t: 'Productos en stock', v: stockItems, i: <Package size={22} /> },
          { t: 'Ganancia neta (período)', v: `$${gananciaPeriodo.toFixed(0)}`, i: <DollarSign size={22} /> },
          { t: 'Deudas pendientes', v: `$${deudas.toFixed(0)}`, i: <AlertTriangle size={22} /> },
        ].map((m, idx) => (
          <motion.div key={idx} variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
            <MetricCard title={m.t} value={m.v} icon={m.i} />
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="lg:col-span-2">
          <ChartCard
            title="Ventas, gastos y ganancia neta"
            right={
              <div className="flex items-center gap-2 text-xs">
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as PeriodKey)}
                  className="bg-white/10 border border-white/10 rounded px-2 py-1"
                >
                  <option value="today">Hoy</option>
                  <option value="7d">7 días</option>
                  <option value="30d">30 días</option>
                  <option value="custom">Rango personalizado</option>
                </select>
                {period === 'custom' && (
                  <div className="flex items-center gap-1">
                    <input
                      type="date"
                      value={customDesde}
                      onChange={(e) => setCustomDesde(e.target.value)}
                      className="bg-white/10 border border-white/10 rounded px-2 py-1"
                    />
                    <span className="text-slate-400">a</span>
                    <input
                      type="date"
                      value={customHasta}
                      onChange={(e) => setCustomHasta(e.target.value)}
                      className="bg-white/10 border border-white/10 rounded px-2 py-1"
                    />
                  </div>
                )}
                <select
                  value={chartType}
                  onChange={(e) => setChartType(e.target.value as ChartKind)}
                  className="bg-white/10 border border-white/10 rounded px-2 py-1"
                >
                  <option value="line">Línea</option>
                  <option value="bar">Barras</option>
                  <option value="area">Áreas</option>
                </select>
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={!canPrint}
                  className={`flex items-center gap-1 px-2 py-1 rounded border text-xs ${canPrint
                      ? 'bg-white/10 border-white/20 hover:bg-white/20 text-slate-100'
                      : 'bg-white/5 border-white/10 text-slate-500 cursor-not-allowed'
                    }`}
                >
                  <Printer size={14} />
                  <span>Imprimir</span>
                </button>
              </div>
            }
          >
            <div className="h-64">
              {movLoading ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">Cargando...</div>
              ) : movError ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">{movError}</div>
              ) : !chartData.length ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  No hay registros para el período seleccionado
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <>
                    {chartType === 'line' && (
                      <LineChart data={chartData}>
                        <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                        <XAxis dataKey="label" tick={{ fill: '#94a3b8' }} axisLine={{ stroke: '#334155' }} tickLine={{ stroke: '#334155' }} />
                        <YAxis tick={{ fill: '#94a3b8' }} axisLine={{ stroke: '#334155' }} tickLine={{ stroke: '#334155' }} />
                        <Tooltip
                          wrapperStyle={{ outline: 'none' }}
                          contentStyle={{
                            background: 'rgba(2,6,23,0.92)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 8,
                            color: '#e2e8f0',
                          }}
                          cursor={{ stroke: '#334155' }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="ventas" name="Ventas" stroke="#22d3ee" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="gastos" name="Gastos" stroke="#f97316" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="neto" name="Ganancia neta" stroke="#a855f7" strokeWidth={2} dot={false} />
                      </LineChart>
                    )}
                    {chartType === 'bar' && (
                      <BarChart data={chartData}>
                        <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                        <XAxis dataKey="label" tick={{ fill: '#94a3b8' }} axisLine={{ stroke: '#334155' }} tickLine={{ stroke: '#334155' }} />
                        <YAxis tick={{ fill: '#94a3b8' }} axisLine={{ stroke: '#334155' }} tickLine={{ stroke: '#334155' }} />
                        <Tooltip
                          wrapperStyle={{ outline: 'none' }}
                          contentStyle={{
                            background: 'rgba(2,6,23,0.92)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 8,
                            color: '#e2e8f0',
                          }}
                          cursor={{ fill: 'rgba(15,23,42,0.6)' }}
                        />
                        <Legend />
                        <Bar dataKey="ventas" name="Ventas" fill="#22d3ee" />
                        <Bar dataKey="gastos" name="Gastos" fill="#f97316" />
                      </BarChart>
                    )}
                    {chartType === 'area' && (
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="gradVentas" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.1} />
                          </linearGradient>
                          <linearGradient id="gradGastos" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f97316" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="#f97316" stopOpacity={0.1} />
                          </linearGradient>
                          <linearGradient id="gradNeto" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#a855f7" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="#a855f7" stopOpacity={0.1} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                        <XAxis dataKey="label" tick={{ fill: '#94a3b8' }} axisLine={{ stroke: '#334155' }} tickLine={{ stroke: '#334155' }} />
                        <YAxis tick={{ fill: '#94a3b8' }} axisLine={{ stroke: '#334155' }} tickLine={{ stroke: '#334155' }} />
                        <Tooltip
                          wrapperStyle={{ outline: 'none' }}
                          contentStyle={{
                            background: 'rgba(2,6,23,0.92)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 8,
                            color: '#e2e8f0',
                          }}
                          cursor={{ stroke: '#334155' }}
                        />
                        <Legend />
                        <Area type="monotone" dataKey="ventas" name="Ventas" stroke="#22d3ee" fill="url(#gradVentas)" />
                        <Area type="monotone" dataKey="gastos" name="Gastos" stroke="#f97316" fill="url(#gradGastos)" />
                        <Area type="monotone" dataKey="neto" name="Ganancia neta" stroke="#a855f7" fill="url(#gradNeto)" />
                      </AreaChart>
                    )}
                  </>
                </ResponsiveContainer>
              )}
            </div>
          </ChartCard>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.08 }}
          className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4"
        >
          <div className="text-sm font-semibold text-slate-200 mb-3">Alertas</div>

          <div className="mb-4">
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Riesgo de stockout</div>
            <ul className="space-y-1">
              {stockouts.length ? (
                stockouts.slice(0, 3).map((r, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="truncate pr-2">{r.producto_nombre}</span>
                    <span className="text-rose-300">{r.dias_hasta_quiebre} d</span>
                  </li>
                ))
              ) : (
                <li className="text-slate-400 text-sm">Sin riesgos detectados</li>
              )}
            </ul>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Anomalías en ventas</div>
            <ul className="space-y-1">
              {anomalias.length ? (
                anomalias.slice(0, 3).map((r, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="truncate pr-2">{new Date(r.dia).toLocaleDateString()}</span>
                    <span className={Math.sign(r.z) >= 0 ? 'text-amber-300' : 'text-cyan-300'}>z {r.z}</span>
                  </li>
                ))
              ) : (
                <li className="text-slate-400 text-sm">Sin anomalías significativas</li>
              )}
            </ul>
          </div>
        </motion.div>
      </div>

      <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4">
        <div className="text-sm text-slate-400 mb-3">Últimas operaciones</div>
        <div className="overflow-x-auto">
          {opsLoading ? (
            <div className="py-6 text-center text-slate-400 text-sm">Cargando...</div>
          ) : opsError ? (
            <div className="py-6 text-center text-slate-400 text-sm">{opsError}</div>
          ) : !ops.length ? (
            <div className="py-6 text-center text-slate-400 text-sm">No hay operaciones recientes</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="py-2">Fecha</th>
                  <th className="py-2">Tipo</th>
                  <th className="py-2">Detalle</th>
                  <th className="py-2">Monto</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {ops.map((r, i) => (
                  <tr key={i} className="border-t border-white/10 hover:bg-white/5">
                    <td className="py-2">{new Date(r.fecha).toLocaleString()}</td>
                    <td className="py-2">{r.tipo}</td>
                    <td className="py-2">{r.detalle}</td>
                    <td className="py-2">${r.monto.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
