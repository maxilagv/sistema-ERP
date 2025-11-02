import { useEffect, useState } from 'react';
import ChartCard from '../ui/ChartCard';
import DataTable from '../ui/DataTable';
import { Api } from '../lib/api';

type Oportunidad = { id: number; cliente_id: number; cliente_nombre: string; titulo: string; fase: string; valor_estimado: number; probabilidad: number; fecha_cierre_estimada?: string };
type Actividad = { id: number; tipo: string; asunto: string; descripcion?: string; fecha_hora?: string; estado: string; cliente_nombre?: string; oportunidad_id?: number };

export default function CRM() {
  const [fase, setFase] = useState<string>('');
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<{ id: number; nombre: string; apellido?: string }[]>([]);

  // UI: crear oportunidad
  const [showOppForm, setShowOppForm] = useState(false);
  const [oppForm, setOppForm] = useState({
    cliente_id: '',
    titulo: '',
    fase: 'lead',
    valor_estimado: '',
    probabilidad: '',
    fecha_cierre_estimada: '',
  });
  const [oppError, setOppError] = useState<string | null>(null);

  // UI: crear actividad
  const [showActForm, setShowActForm] = useState(false);
  const [actForm, setActForm] = useState({
    tipo: 'llamada',
    asunto: '',
    descripcion: '',
    fecha_hora: '',
    estado: 'pendiente',
    cliente_id: '',
    oportunidad_id: '',
  });
  const [actError, setActError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [ops, acts, cls] = await Promise.all([
          Api.oportunidades({ fase: fase || undefined, limit: 50 }),
          Api.actividades({ estado: 'pendiente', limit: 50 }),
          Api.clientes(),
        ]);
        setOportunidades(ops || []);
        setActividades(acts || []);
        setClientes((cls || []).map((c: any) => ({ id: c.id, nombre: c.nombre, apellido: c.apellido })));
      } catch (_) { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [fase]);

  async function crearOportunidad() {
    setOppError(null);
    const body: any = {
      cliente_id: oppForm.cliente_id ? Number(oppForm.cliente_id) : undefined,
      titulo: oppForm.titulo.trim(),
      fase: oppForm.fase || undefined,
      valor_estimado: oppForm.valor_estimado !== '' ? Number(oppForm.valor_estimado) : undefined,
      probabilidad: oppForm.probabilidad !== '' ? Number(oppForm.probabilidad) : undefined,
      fecha_cierre_estimada: oppForm.fecha_cierre_estimada ? new Date(oppForm.fecha_cierre_estimada).toISOString().slice(0, 10) : undefined,
    };
    if (!body.cliente_id || !body.titulo) {
      setOppError('Selecciona un cliente y agrega un título');
      return;
    }
    try {
      await Api.crearOportunidad(body);
      setOppForm({ cliente_id: '', titulo: '', fase: 'lead', valor_estimado: '', probabilidad: '', fecha_cierre_estimada: '' });
      setShowOppForm(false);
      // recargar lista
      const ops = await Api.oportunidades({ fase: fase || undefined, limit: 50 });
      setOportunidades(ops || []);
    } catch (e: any) {
      setOppError(e?.message || 'No se pudo crear la oportunidad');
    }
  }

  async function crearActividad() {
    setActError(null);
    const body: any = {
      tipo: actForm.tipo,
      asunto: actForm.asunto.trim(),
      descripcion: actForm.descripcion.trim() || undefined,
      fecha_hora: actForm.fecha_hora ? new Date(actForm.fecha_hora).toISOString() : undefined,
      estado: actForm.estado || 'pendiente',
      cliente_id: actForm.cliente_id ? Number(actForm.cliente_id) : undefined,
      oportunidad_id: actForm.oportunidad_id ? Number(actForm.oportunidad_id) : undefined,
    };
    if (!body.tipo || !body.asunto) {
      setActError('Selecciona tipo y escribe un asunto');
      return;
    }
    try {
      await Api.crearActividad(body);
      setActForm({ tipo: 'llamada', asunto: '', descripcion: '', fecha_hora: '', estado: 'pendiente', cliente_id: '', oportunidad_id: '' });
      setShowActForm(false);
      const acts = await Api.actividades({ estado: 'pendiente', limit: 50 });
      setActividades(acts || []);
    } catch (e: any) {
      setActError(e?.message || 'No se pudo crear la actividad');
    }
  }

  const fases = ['lead','contacto','propuesta','negociacion','ganado','perdido'];

  return (
    <div className="space-y-6">
      <ChartCard title="Embudo de oportunidades" right={
        <div className="flex items-center gap-2">
          <select value={fase} onChange={(e) => setFase(e.target.value)} className="bg-white/10 border border-white/10 rounded px-2 py-1 text-sm">
            <option value="">Todas</option>
            {fases.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <button onClick={() => setShowOppForm(s => !s)} className="px-2 py-1 rounded bg-primary-500/20 border border-primary-500/30 hover:bg-primary-500/30 text-primary-200 text-xs">
            {showOppForm ? 'Cancelar' : 'Nueva oportunidad'}
          </button>
        </div>
      }>
        {showOppForm && (
          <div className="mb-4 p-3 rounded-lg border border-white/10 bg-white/5">
            {oppError && <div className="mb-2 text-rose-300 text-sm">{oppError}</div>}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-2 text-sm">
              <select value={oppForm.cliente_id} onChange={(e)=>setOppForm({...oppForm, cliente_id: e.target.value})} className="bg-white/10 border border-white/10 rounded px-2 py-1">
                <option value="">Cliente</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.apellido?` ${c.apellido}`:''}</option>)}
              </select>
              <input value={oppForm.titulo} onChange={(e)=>setOppForm({...oppForm, titulo: e.target.value})} placeholder="Título" className="bg-white/10 border border-white/10 rounded px-2 py-1 md:col-span-2" />
              <select value={oppForm.fase} onChange={(e)=>setOppForm({...oppForm, fase: e.target.value})} className="bg-white/10 border border-white/10 rounded px-2 py-1">
                {fases.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <input type="number" placeholder="Valor estimado" value={oppForm.valor_estimado} onChange={(e)=>setOppForm({...oppForm, valor_estimado: e.target.value})} className="bg-white/10 border border-white/10 rounded px-2 py-1" />
              <input type="number" placeholder="Probabilidad %" value={oppForm.probabilidad} onChange={(e)=>setOppForm({...oppForm, probabilidad: e.target.value})} className="bg-white/10 border border-white/10 rounded px-2 py-1" />
              <input type="date" value={oppForm.fecha_cierre_estimada} onChange={(e)=>setOppForm({...oppForm, fecha_cierre_estimada: e.target.value})} className="bg-white/10 border border-white/10 rounded px-2 py-1" />
            </div>
            <div className="mt-3 flex justify-end">
              <button onClick={crearOportunidad} className="px-3 py-1.5 rounded bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 text-emerald-200 text-sm">Crear</button>
            </div>
          </div>
        )}
        <DataTable headers={
          <thead className="text-left text-slate-400">
            <tr>
              <th className="py-2 px-2">Oportunidad</th>
              <th className="py-2 px-2">Cliente</th>
              <th className="py-2 px-2">Fase</th>
              <th className="py-2 px-2">Valor</th>
              <th className="py-2 px-2">Probabilidad</th>
              <th className="py-2 px-2">Cierre est.</th>
            </tr>
          </thead>
        }>
          <tbody className="text-slate-200">
            {(loading ? [] : oportunidades).map((o) => (
              <tr key={o.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="py-2 px-2">{o.titulo}</td>
                <td className="py-2 px-2">{o.cliente_nombre}</td>
                <td className="py-2 px-2">{o.fase}</td>
                <td className="py-2 px-2">{"$" + (o.valor_estimado || 0).toFixed(0)}</td>
                <td className="py-2 px-2">{o.probabilidad}%</td>
                <td className="py-2 px-2">{o.fecha_cierre_estimada ? new Date(o.fecha_cierre_estimada).toLocaleDateString() : '-'}</td>
              </tr>
            ))}
            {!loading && oportunidades.length === 0 && (
              <tr><td className="py-3 px-2 text-slate-400" colSpan={6}>Sin oportunidades</td></tr>
            )}
          </tbody>
        </DataTable>
      </ChartCard>

      <ChartCard title="Actividades pendientes" right={
        <button onClick={() => setShowActForm(s => !s)} className="px-2 py-1 rounded bg-primary-500/20 border border-primary-500/30 hover:bg-primary-500/30 text-primary-200 text-xs">
          {showActForm ? 'Cancelar' : 'Nueva actividad'}
        </button>
      }>
        {showActForm && (
          <div className="mb-4 p-3 rounded-lg border border-white/10 bg-white/5">
            {actError && <div className="mb-2 text-rose-300 text-sm">{actError}</div>}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-2 text-sm">
              <select value={actForm.tipo} onChange={(e)=>setActForm({...actForm, tipo: e.target.value})} className="bg-white/10 border border-white/10 rounded px-2 py-1">
                {['llamada','reunion','tarea'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input value={actForm.asunto} onChange={(e)=>setActForm({...actForm, asunto: e.target.value})} placeholder="Asunto" className="bg-white/10 border border-white/10 rounded px-2 py-1 md:col-span-2" />
              <select value={actForm.estado} onChange={(e)=>setActForm({...actForm, estado: e.target.value})} className="bg-white/10 border border-white/10 rounded px-2 py-1">
                {['pendiente','completado','cancelado'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input type="datetime-local" value={actForm.fecha_hora} onChange={(e)=>setActForm({...actForm, fecha_hora: e.target.value})} className="bg-white/10 border border-white/10 rounded px-2 py-1" />
              <input value={actForm.descripcion} onChange={(e)=>setActForm({...actForm, descripcion: e.target.value})} placeholder="Descripción (opcional)" className="bg-white/10 border border-white/10 rounded px-2 py-1 md:col-span-3" />
              <select value={actForm.cliente_id} onChange={(e)=>setActForm({...actForm, cliente_id: e.target.value})} className="bg-white/10 border border-white/10 rounded px-2 py-1">
                <option value="">Cliente (opcional)</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.apellido?` ${c.apellido}`:''}</option>)}
              </select>
              <select value={actForm.oportunidad_id} onChange={(e)=>setActForm({...actForm, oportunidad_id: e.target.value})} className="bg-white/10 border border-white/10 rounded px-2 py-1">
                <option value="">Oportunidad (opcional)</option>
                {oportunidades.map(o => <option key={o.id} value={o.id}>{o.titulo}</option>)}
              </select>
            </div>
            <div className="mt-3 flex justify-end">
              <button onClick={crearActividad} className="px-3 py-1.5 rounded bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 text-emerald-200 text-sm">Crear</button>
            </div>
          </div>
        )}
        <DataTable headers={
          <thead className="text-left text-slate-400">
            <tr>
              <th className="py-2 px-2">Tipo</th>
              <th className="py-2 px-2">Asunto</th>
              <th className="py-2 px-2">Cliente</th>
              <th className="py-2 px-2">Fecha</th>
              <th className="py-2 px-2">Estado</th>
            </tr>
          </thead>
        }>
          <tbody className="text-slate-200">
            {(loading ? [] : actividades).map((a) => (
              <tr key={a.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="py-2 px-2">{a.tipo}</td>
                <td className="py-2 px-2">{a.asunto}</td>
                <td className="py-2 px-2">{a.cliente_nombre || '-'}</td>
                <td className="py-2 px-2">{a.fecha_hora ? new Date(a.fecha_hora).toLocaleString() : '-'}</td>
                <td className="py-2 px-2">{a.estado}</td>
              </tr>
            ))}
            {!loading && actividades.length === 0 && (
              <tr><td className="py-3 px-2 text-slate-400" colSpan={5}>Sin actividades</td></tr>
            )}
          </tbody>
        </DataTable>
      </ChartCard>
    </div>
  );
}
