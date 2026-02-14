import { useEffect, useState } from 'react';
import { Api } from '../lib/api';
import Button from '../ui/Button';

type Rule = {
  id: number;
  clave: string;
  nombre: string;
  tipo: string;
  severidad: string;
  umbral_num: number;
  ventana_minutos: number;
  canal: 'email' | 'sms' | 'ambos';
  activo: boolean;
};

type EventRow = {
  id: number;
  tipo: string;
  severidad: string;
  titulo: string;
  descripcion?: string;
  estado: 'abierta' | 'ack' | 'cerrada';
  detectado_en: string;
};

export default function Alarmas() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rules, setRules] = useState<Rule[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [recipients, setRecipients] = useState<any[]>([]);

  const [newRecipient, setNewRecipient] = useState({
    nombre: '',
    email: '',
    telefono: '',
    canal_preferido: 'email',
  });

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [r, e, n, d] = await Promise.all([
        Api.alarmasReglas(),
        Api.alarmasEventos({ limit: 120 }),
        Api.alarmasNotificaciones({ limit: 120 }),
        Api.alarmasDestinatarios(),
      ]);
      setRules((r as Rule[]) || []);
      setEvents((e as EventRow[]) || []);
      setNotifications((n as any[]) || []);
      setRecipients((d as any[]) || []);
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar las alarmas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function runEvaluation() {
    try {
      await Api.alarmasEvaluar();
      await loadAll();
    } catch (e: any) {
      setError(e?.message || 'No se pudo ejecutar evaluacion');
    }
  }

  async function processQueue() {
    try {
      await Api.alarmasProcesarCola(100);
      await loadAll();
    } catch (e: any) {
      setError(e?.message || 'No se pudo procesar la cola de notificaciones');
    }
  }

  async function toggleRule(rule: Rule) {
    try {
      await Api.actualizarAlarmaRegla(rule.id, { activo: !rule.activo });
      await loadAll();
    } catch (e: any) {
      setError(e?.message || 'No se pudo actualizar la regla');
    }
  }

  async function ackEvent(id: number) {
    try {
      await Api.alarmaAck(id);
      await loadAll();
    } catch (e: any) {
      setError(e?.message || 'No se pudo marcar en revision');
    }
  }

  async function closeEvent(id: number) {
    try {
      await Api.alarmaCerrar(id);
      await loadAll();
    } catch (e: any) {
      setError(e?.message || 'No se pudo cerrar el evento');
    }
  }

  async function addRecipient(e: React.FormEvent) {
    e.preventDefault();
    try {
      await Api.crearAlarmaDestinatario({
        nombre: newRecipient.nombre,
        email: newRecipient.email || null,
        telefono: newRecipient.telefono || null,
        canal_preferido: newRecipient.canal_preferido,
      });
      setNewRecipient({ nombre: '', email: '', telefono: '', canal_preferido: 'email' });
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'No se pudo agregar destinatario');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Alarmas</h2>
        <button
          type="button"
          className="ml-auto px-3 py-2 rounded-md text-sm bg-indigo-600 text-white hover:bg-indigo-500"
          onClick={runEvaluation}
        >
          Evaluar reglas
        </button>
        <button
          type="button"
          className="px-3 py-2 rounded-md text-sm bg-slate-700 text-white hover:bg-slate-600"
          onClick={processQueue}
        >
          Procesar cola
        </button>
        <button
          type="button"
          className="px-3 py-2 rounded-md text-sm bg-slate-900 text-slate-200 hover:bg-slate-800"
          onClick={loadAll}
        >
          Refrescar
        </button>
      </div>

      {error && <div className="rounded-md border border-red-300 bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>}
      {loading && <div className="text-sm text-slate-500">Cargando alarmas...</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Reglas activas</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Regla</th>
                  <th className="py-2 pr-3">Canal</th>
                  <th className="py-2 pr-3">Umbral</th>
                  <th className="py-2 pr-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{r.nombre}</div>
                      <div className="text-xs text-slate-500">{r.tipo}</div>
                    </td>
                    <td className="py-2 pr-3">{r.canal}</td>
                    <td className="py-2 pr-3">{r.umbral_num} / {r.ventana_minutos}m</td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        className={`px-2 py-1 rounded text-xs ${r.activo ? 'bg-emerald-600 text-white' : 'bg-slate-500 text-white'}`}
                        onClick={() => toggleRule(r)}
                      >
                        {r.activo ? 'Activa' : 'Inactiva'}
                      </button>
                    </td>
                  </tr>
                ))}
                {!rules.length && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-500">Sin reglas configuradas</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Destinatarios</h3>
          <form onSubmit={addRecipient} className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              className="input-modern"
              placeholder="Nombre"
              value={newRecipient.nombre}
              onChange={(e) => setNewRecipient((p) => ({ ...p, nombre: e.target.value }))}
              required
            />
            <select
              className="input-modern"
              value={newRecipient.canal_preferido}
              onChange={(e) => setNewRecipient((p) => ({ ...p, canal_preferido: e.target.value }))}
            >
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="ambos">Ambos</option>
            </select>
            <input
              className="input-modern"
              placeholder="Email"
              value={newRecipient.email}
              onChange={(e) => setNewRecipient((p) => ({ ...p, email: e.target.value }))}
            />
            <input
              className="input-modern"
              placeholder="Telefono"
              value={newRecipient.telefono}
              onChange={(e) => setNewRecipient((p) => ({ ...p, telefono: e.target.value }))}
            />
            <div className="md:col-span-2">
              <Button type="submit">Agregar destinatario</Button>
            </div>
          </form>
          <div className="space-y-2">
            {recipients.map((r) => (
              <div key={r.id} className="rounded border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm">
                <div className="font-medium">{r.nombre}</div>
                <div className="text-slate-500">{r.email || '-'} / {r.telefono || '-'}</div>
              </div>
            ))}
            {!recipients.length && <div className="text-sm text-slate-500">Sin destinatarios.</div>}
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Eventos</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-2 pr-3">Fecha</th>
                <th className="py-2 pr-3">Severidad</th>
                <th className="py-2 pr-3">Titulo</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-2 pr-3">{new Date(ev.detectado_en).toLocaleString()}</td>
                  <td className="py-2 pr-3 uppercase text-xs">{ev.severidad}</td>
                  <td className="py-2 pr-3">{ev.titulo}</td>
                  <td className="py-2 pr-3">{ev.estado}</td>
                  <td className="py-2 pr-3 space-x-2">
                    <button
                      type="button"
                      className="text-xs px-2 py-1 rounded bg-amber-600 text-white disabled:opacity-50"
                      disabled={ev.estado === 'cerrada'}
                      onClick={() => ackEvent(ev.id)}
                    >
                      Ack
                    </button>
                    <button
                      type="button"
                      className="text-xs px-2 py-1 rounded bg-emerald-700 text-white disabled:opacity-50"
                      disabled={ev.estado === 'cerrada'}
                      onClick={() => closeEvent(ev.id)}
                    >
                      Cerrar
                    </button>
                  </td>
                </tr>
              ))}
              {!events.length && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-500">Sin eventos.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Cola de notificaciones</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-2 pr-3">ID</th>
                <th className="py-2 pr-3">Canal</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Reintentos</th>
                <th className="py-2 pr-3">Destino</th>
                <th className="py-2 pr-3">Error</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => (
                <tr key={n.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-2 pr-3">#{n.id}</td>
                  <td className="py-2 pr-3">{n.canal}</td>
                  <td className="py-2 pr-3">{n.estado}</td>
                  <td className="py-2 pr-3">{n.reintentos}/{n.max_reintentos}</td>
                  <td className="py-2 pr-3">{n.email || n.telefono || '-'}</td>
                  <td className="py-2 pr-3 text-xs text-red-500">{n.ultimo_error || '-'}</td>
                </tr>
              ))}
              {!notifications.length && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-slate-500">Sin notificaciones.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
