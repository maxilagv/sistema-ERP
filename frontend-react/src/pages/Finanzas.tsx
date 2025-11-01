import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

const data = [
  { m: 'Ene', g: 40, n: 24 },
  { m: 'Feb', g: 30, n: 13 },
  { m: 'Mar', g: 20, n: 12 },
  { m: 'Abr', g: 27, n: 19 },
  { m: 'May', g: 18, n: 10 },
  { m: 'Jun', g: 23, n: 16 },
];

export default function Finanzas() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Finanzas</h2>
      <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4">
        <div className="text-sm text-slate-500 mb-2">Ganancias brutas vs. netas</div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <XAxis dataKey="m" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip />
              <Area type="monotone" dataKey="g" stackId="1" stroke="#4f46e5" fill="#6366f1" fillOpacity={0.25} />
              <Area type="monotone" dataKey="n" stackId="1" stroke="#06b6d4" fill="#22d3ee" fillOpacity={0.25} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4">
        <div className="text-sm text-slate-500 mb-2">Gastos</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-2">Fecha</th>
                <th className="py-2">Concepto</th>
                <th className="py-2">Monto</th>
              </tr>
            </thead>
            <tbody className="text-slate-700 dark:text-slate-200">
              {[
                { f: '2025-01-10', c: 'Importación', m: '$320.000' },
                { f: '2025-01-08', c: 'Logística', m: '$42.110' },
              ].map((r, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="py-2">{r.f}</td>
                  <td className="py-2">{r.c}</td>
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

