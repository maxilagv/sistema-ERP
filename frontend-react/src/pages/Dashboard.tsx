import { useEffect, useState } from 'react';
import { Users, Package, DollarSign, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import MetricCard from '../ui/MetricCard';
import ChartCard from '../ui/ChartCard';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Api } from '../lib/api';

export default function Dashboard() {
  const [lineData, setLineData] = useState<{ m: string; v: number }[]>([]);
  const [deudas, setDeudas] = useState<number>(0);
  const [clientesCount, setClientesCount] = useState<number>(0);
  const [stockItems, setStockItems] = useState<number>(0);

  useEffect(() => {
    (async () => {
      try {
        const [g, d, c, inv] = await Promise.all([
          Api.gananciasMensuales(),
          Api.deudas(),
          Api.clientes(),
          Api.inventario(),
        ]);
        setLineData(g.map((row: any) => ({ m: new Date(row.mes).toLocaleDateString(undefined, { month: 'short' }), v: Number(row.ganancia_neta || 0) })));
        setDeudas(d.reduce((acc: number, r: any) => acc + Number(r.deuda_pendiente || 0), 0));
        setClientesCount(c.length);
        setStockItems(inv.reduce((acc: number, r: any) => acc + Number(r.cantidad_disponible || 0), 0));
      } catch {}
    })();
  }, []);

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
          { t: 'Ganancia neta (meses)', v: lineData.slice(-1)[0]?.v?.toFixed?.(0) || '0', i: <DollarSign size={22} /> },
          { t: 'Deudas pendientes', v: `$${deudas.toFixed(0)}`, i: <AlertTriangle size={22} /> },
        ].map((m, idx) => (
          <motion.div key={idx} variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
            <MetricCard title={m.t} value={m.v} icon={m.i} />
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="lg:col-span-2">
          <ChartCard title="Ganancias mensuales">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData}>
                  <defs>
                    <linearGradient id="gradLine" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#22d3ee" />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="m" tick={{ fill: '#94a3b8' }} axisLine={{ stroke: '#334155' }} tickLine={{ stroke: '#334155' }} />
                  <YAxis tick={{ fill: '#94a3b8' }} axisLine={{ stroke: '#334155' }} tickLine={{ stroke: '#334155' }} />
                  <Tooltip wrapperStyle={{ outline: 'none' }} contentStyle={{ background: 'rgba(2,6,23,0.92)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }} cursor={{ stroke: '#334155' }} />
                  <Line type="monotone" dataKey="v" stroke="url(#gradLine)" strokeWidth={3} dot={false} isAnimationActive animationDuration={600} animationEasing="ease-out" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08 }} className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4" />
      </div>

      <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4">
        <div className="text-sm text-slate-400 mb-3">Últimas operaciones</div>
        <div className="overflow-x-auto">
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
              {[
                { f: '-', t: '-', d: 'Conecta el backend para ver datos en vivo', m: '-' },
              ].map((r, i) => (
                <tr key={i} className="border-t border-white/10 hover:bg-white/5">
                  <td className="py-2">{r.f}</td>
                  <td className="py-2">{r.t}</td>
                  <td className="py-2">{r.d}</td>
                  <td className="py-2">{r.m}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
