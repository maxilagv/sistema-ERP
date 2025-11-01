import { useEffect, useMemo, useState } from 'react';
import { Api } from '../lib/api';
import Button from '../ui/Button';
import Alert from '../components/Alert';

type Cliente = { id: number; nombre: string; apellido?: string; email?: string };

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [deudas, setDeudas] = useState<Record<number, number>>({});
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: '', apellido: '', email: '', telefono: '', direccion: '', cuit_cuil: '' });
  const canCreate = useMemo(() => Boolean(form.nombre), [form]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [clis, deudaRows] = await Promise.all([Api.clientes(), Api.deudas()]);
      setClientes(clis);
      const map: Record<number, number> = {};
      for (const d of deudaRows) map[d.cliente_id] = Number(d.deuda_pendiente || 0);
      setDeudas(map);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => clientes.filter(c => `${c.nombre} ${c.apellido||''} ${c.email||''}`.toLowerCase().includes(q.toLowerCase())), [clientes, q]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Clientes</h2>
      <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4">
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!canCreate) return;
          setError(null);
          try {
            await Api.crearCliente({
              nombre: form.nombre,
              apellido: form.apellido || undefined,
              email: form.email || undefined,
              telefono: form.telefono || undefined,
              direccion: form.direccion || undefined,
              cuit_cuil: form.cuit_cuil || undefined,
            });
            setForm({ nombre: '', apellido: '', email: '', telefono: '', direccion: '', cuit_cuil: '' });
            await load();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo crear el cliente');
          }
        }} className="grid grid-cols-1 md:grid-cols-6 gap-2">
          {error && <div className="md:col-span-6"><Alert kind="error" message={error} /></div>}
          <input className="input-modern text-sm" placeholder="Nombre" value={form.nombre} onChange={(e)=>setForm({...form, nombre: e.target.value})} />
          <input className="input-modern text-sm" placeholder="Apellido" value={form.apellido} onChange={(e)=>setForm({...form, apellido: e.target.value})} />
          <input className="input-modern text-sm" placeholder="Email" type="email" value={form.email} onChange={(e)=>setForm({...form, email: e.target.value})} />
          <input className="input-modern text-sm" placeholder="Teléfono" value={form.telefono} onChange={(e)=>setForm({...form, telefono: e.target.value})} />
          <input className="input-modern text-sm" placeholder="Dirección" value={form.direccion} onChange={(e)=>setForm({...form, direccion: e.target.value})} />
          <input className="input-modern text-sm" placeholder="CUIT/CUIL" value={form.cuit_cuil} onChange={(e)=>setForm({...form, cuit_cuil: e.target.value})} />
          <Button type="submit" disabled={!canCreate} className="md:col-span-6">Registrar cliente</Button>
        </form>
      </div>
      <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4">
        <div className="flex items-center justify-between mb-3">
          <input className="input-modern" placeholder="Buscar por nombre o email" value={q} onChange={(e)=>setQ(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-8 text-center text-slate-500">Cargando...</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="py-2">Nombre</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Deuda</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {filtered.map((c) => (
                  <tr key={c.id} className="border-t border-white/10 hover:bg-white/5">
                    <td className="py-2">{c.nombre} {c.apellido}</td>
                    <td className="py-2">{c.email || '-'}</td>
                    <td className="py-2">${(deudas[c.id] || 0).toFixed(2)}</td>
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




