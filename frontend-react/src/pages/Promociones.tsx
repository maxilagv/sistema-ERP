import { useEffect, useState } from 'react';
import { Api } from '../lib/api';
import Button from '../ui/Button';

type Promo = {
  id: number;
  titulo: string;
  descripcion?: string;
  descuento_porcentaje?: number | null;
  codigo?: string | null;
  segmento?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  activo: boolean;
};

export default function Promociones() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Promo[]>([]);

  const [form, setForm] = useState({
    titulo: '',
    descripcion: '',
    descuento_porcentaje: '',
    codigo: '',
    segmento: '',
    fecha_inicio: '',
    fecha_fin: '',
    activo: true,
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const rows = await Api.promociones({ incluirInactivas: true });
      setItems((rows as Promo[]) || []);
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar las promociones');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await Api.crearPromocion({
        titulo: form.titulo,
        descripcion: form.descripcion || null,
        descuento_porcentaje:
          form.descuento_porcentaje === '' ? null : Number(form.descuento_porcentaje),
        codigo: form.codigo || null,
        segmento: form.segmento || null,
        fecha_inicio: form.fecha_inicio || null,
        fecha_fin: form.fecha_fin || null,
        activo: form.activo,
      });
      setForm({
        titulo: '',
        descripcion: '',
        descuento_porcentaje: '',
        codigo: '',
        segmento: '',
        fecha_inicio: '',
        fecha_fin: '',
        activo: true,
      });
      await load();
    } catch (err: any) {
      setError(err?.message || 'No se pudo crear la promocion');
    }
  }

  async function toggleActive(promo: Promo) {
    try {
      await Api.actualizarPromocion(promo.id, { activo: !promo.activo });
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo actualizar la promocion');
    }
  }

  async function removePromo(id: number) {
    try {
      await Api.eliminarPromocion(id);
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo eliminar la promocion');
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Promociones</h2>
      {error && <div className="rounded-md border border-red-300 bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>}

      <form onSubmit={onCreate} className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          className="input-modern"
          placeholder="Titulo"
          value={form.titulo}
          onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))}
          required
        />
        <input
          className="input-modern"
          placeholder="Codigo"
          value={form.codigo}
          onChange={(e) => setForm((p) => ({ ...p, codigo: e.target.value }))}
        />
        <input
          className="input-modern"
          placeholder="Segmento (opcional)"
          value={form.segmento}
          onChange={(e) => setForm((p) => ({ ...p, segmento: e.target.value }))}
        />
        <input
          className="input-modern"
          type="number"
          min={0}
          max={100}
          step="0.1"
          placeholder="Descuento %"
          value={form.descuento_porcentaje}
          onChange={(e) => setForm((p) => ({ ...p, descuento_porcentaje: e.target.value }))}
        />
        <input
          className="input-modern"
          type="date"
          value={form.fecha_inicio}
          onChange={(e) => setForm((p) => ({ ...p, fecha_inicio: e.target.value }))}
        />
        <input
          className="input-modern"
          type="date"
          value={form.fecha_fin}
          onChange={(e) => setForm((p) => ({ ...p, fecha_fin: e.target.value }))}
        />
        <textarea
          className="input-modern md:col-span-2 min-h-[80px]"
          placeholder="Descripcion"
          value={form.descripcion}
          onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
        />
        <label className="md:col-span-2 inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={form.activo}
            onChange={(e) => setForm((p) => ({ ...p, activo: e.target.checked }))}
          />
          Activa
        </label>
        <div className="md:col-span-2">
          <Button type="submit">Crear promocion</Button>
        </div>
      </form>

      <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4 overflow-x-auto">
        {loading ? (
          <div className="text-sm text-slate-500">Cargando promociones...</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-2 pr-3">Titulo</th>
                <th className="py-2 pr-3">Descuento</th>
                <th className="py-2 pr-3">Codigo</th>
                <th className="py-2 pr-3">Segmento</th>
                <th className="py-2 pr-3">Vigencia</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-2 pr-3">{p.titulo}</td>
                  <td className="py-2 pr-3">{p.descuento_porcentaje != null ? `${Number(p.descuento_porcentaje).toFixed(1)}%` : '-'}</td>
                  <td className="py-2 pr-3">{p.codigo || '-'}</td>
                  <td className="py-2 pr-3">{p.segmento || 'Todos'}</td>
                  <td className="py-2 pr-3">{p.fecha_inicio || '-'} / {p.fecha_fin || '-'}</td>
                  <td className="py-2 pr-3">{p.activo ? 'Activa' : 'Inactiva'}</td>
                  <td className="py-2 pr-3 space-x-2">
                    <button
                      type="button"
                      className="text-xs px-2 py-1 rounded bg-indigo-600 text-white"
                      onClick={() => toggleActive(p)}
                    >
                      {p.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      type="button"
                      className="text-xs px-2 py-1 rounded bg-red-700 text-white"
                      onClick={() => removePromo(p.id)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-slate-500">Sin promociones registradas.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
