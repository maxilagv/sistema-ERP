import { useEffect, useState, type FormEvent } from 'react';
import { Api, apiFetch } from '../lib/api';
import Alert from '../components/Alert';

export default function ConfiguracionAdmin() {
  const [dolarBlue, setDolarBlue] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [usuariosLoading, setUsuariosLoading] = useState(false);
  const [usuariosError, setUsuariosError] = useState<string | null>(null);
  const [depositos, setDepositos] = useState<any[]>([]);
  const [permisosSaving, setPermisosSaving] = useState(false);
  const [selectedUsuarioId, setSelectedUsuarioId] = useState<number | ''>('');
  const [usuarioDepositoIds, setUsuarioDepositoIds] = useState<number[]>([]);
  const [permisosSuccess, setPermisosSuccess] = useState<string | null>(null);
  const [permisosError, setPermisosError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await Api.getDolarBlue();
        if (!mounted) return;
        const valor =
          data && typeof (data as any).valor === 'number'
            ? (data as any).valor
            : null;
        if (valor != null) {
          setDolarBlue(String(valor));
        }
      } catch (e) {
        if (!mounted) return;
        setError(
          e instanceof Error
            ? e.message
            : 'No se pudo cargar el dólar blue'
        );
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    (async () => {
      setUsuariosLoading(true);
      setUsuariosError(null);
      try {
        const [usersRes, depsRes] = await Promise.all([
          apiFetch('/api/usuarios').catch(() => []),
          Api.depositos().catch(() => []),
        ]);
        setUsuarios(Array.isArray(usersRes) ? usersRes : []);
        setDepositos(Array.isArray(depsRes) ? depsRes : []);
      } catch (e) {
        setUsuariosError(
          e instanceof Error
            ? e.message
            : 'No se pudieron cargar usuarios o depЗsitos',
        );
      } finally {
        setUsuariosLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    async function loadPermisos() {
      if (!selectedUsuarioId) {
        setUsuarioDepositoIds([]);
        return;
      }
      setPermisosError(null);
      setPermisosSuccess(null);
      try {
        const data = await apiFetch(`/api/usuarios/${selectedUsuarioId}/depositos`);
        const ids = Array.isArray(data)
          ? data
              .map((d: any) => Number(d.deposito_id ?? d.id))
              .filter((n) => Number.isInteger(n) && n > 0)
          : [];
        setUsuarioDepositoIds(ids);
      } catch (e) {
        setPermisosError(
          e instanceof Error
            ? e.message
            : 'No se pudieron cargar los depЗsitos del usuario',
        );
        setUsuarioDepositoIds([]);
      }
    }
    loadPermisos();
  }, [selectedUsuarioId]);

  async function onSubmitDolar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const valorNum = Number(dolarBlue);
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      setError('Ingresá un valor de dólar válido mayor a 0');
      return;
    }
    setSaving(true);
    try {
      await Api.setDolarBlue(valorNum);
      setSuccess('Dólar blue actualizado correctamente');
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudo guardar el valor de dólar'
      );
    } finally {
      setSaving(false);
    }
  }

  async function onResetPanel() {
    setResetError(null);
    setResetSuccess(null);
    const confirmed = window.confirm(
      '¿Seguro que querés borrar todos los datos del panel (clientes, productos, ventas, compras, etc.)? Esta acción no se puede deshacer.'
    );
    if (!confirmed) return;
    setResetting(true);
    try {
      await Api.resetPanelData();
      setResetSuccess('Datos del panel limpiados correctamente.');
    } catch (e) {
      setResetError(
        e instanceof Error
          ? e.message
          : 'No se pudieron limpiar los datos del panel'
      );
    } finally {
      setResetting(false);
    }
  }

  function toggleUsuarioDeposito(depositoId: number) {
    setUsuarioDepositoIds((prev) =>
      prev.includes(depositoId)
        ? prev.filter((id) => id !== depositoId)
        : [...prev, depositoId],
    );
  }

  async function onGuardarPermisos(e: FormEvent) {
    e.preventDefault();
    if (!selectedUsuarioId) return;
    setPermisosError(null);
    setPermisosSuccess(null);
    setPermisosSaving(true);
    try {
      const payload = {
        depositos: usuarioDepositoIds.map((id) => ({ deposito_id: id })),
      };
      await apiFetch(`/api/usuarios/${selectedUsuarioId}/depositos`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setPermisosSuccess('Permisos de depЗsitos actualizados correctamente');
    } catch (e) {
      setPermisosError(
        e instanceof Error
          ? e.message
          : 'No se pudieron guardar los permisos de depЗsitos',
      );
    } finally {
      setPermisosSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">
        Configuración
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4">
          <div className="text-sm text-slate-300 mb-2">Datos del negocio</div>
          <div className="space-y-3">
            <input
              className="input-modern w-full text-sm"
              placeholder="Nombre del comercio (opcional)"
            />
            <input
              className="input-modern w-full text-sm"
              placeholder="Email de contacto (opcional)"
            />
            <input
              className="input-modern w-full text-sm"
              placeholder="Moneda de facturación (ej: ARS)"
            />
          </div>
        </div>

        <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4">
          <div className="text-sm text-slate-300 mb-2">Branding</div>
          <div className="space-y-3">
            <input
              className="input-modern w-full text-sm"
              placeholder="URL del logo (opcional)"
            />
            <input
              className="input-modern w-full text-sm"
              placeholder="Subtítulo o lema (opcional)"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4">
          <div className="text-sm text-slate-300 mb-2">
            Dólar blue para precios
          </div>
          <div className="space-y-3">
            {error && <Alert kind="error" message={error} />}
            {success && <Alert kind="info" message={success} />}
            <form onSubmit={onSubmitDolar} className="space-y-2">
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
                <input
                  className="input-modern flex-1 text-sm"
                  placeholder="Ej: 1500"
                  type="number"
                  step="0.01"
                  value={dolarBlue}
                  onChange={(e) => setDolarBlue(e.target.value)}
                  disabled={loading || saving}
                />
                <button
                  type="submit"
                  className="h-11 rounded-lg bg-emerald-600 text-white px-4 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={loading || saving}
                >
                  {saving ? 'Guardando...' : 'Guardar dólar'}
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Este valor se usará como tipo de cambio base (dólar blue) para
                los cálculos de precios de todos los productos en USD.
              </p>
            </form>
          </div>
        </div>

        <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4">
          <div className="text-sm text-slate-300 mb-2">Herramientas avanzadas</div>
          <div className="space-y-3">
            {resetError && <Alert kind="error" message={resetError} />}
            {resetSuccess && <Alert kind="info" message={resetSuccess} />}
            <button
              type="button"
              onClick={onResetPanel}
              className="h-11 w-full rounded-lg bg-red-600 text-white px-4 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={resetting}
            >
              {resetting ? 'Limpiando datos...' : 'Limpiar datos del panel'}
            </button>
            <p className="text-xs text-slate-400">
              Borra clientes, productos, ventas, compras, CRM, tickets y logs cargados desde el panel.
              No toca usuarios ni datos de login.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4">
          <div className="text-sm text-slate-300 mb-2">
            Permisos de depИsitos por usuario
          </div>
          <div className="space-y-3 text-sm">
            {usuariosError && <Alert kind="error" message={usuariosError} />}
            {permisosError && <Alert kind="error" message={permisosError} />}
            {permisosSuccess && <Alert kind="info" message={permisosSuccess} />}
            <form onSubmit={onGuardarPermisos} className="space-y-3">
              <div className="flex flex-col md:flex-row gap-2 md:items-center">
                <div className="flex-1">
                  <label className="block text-xs text-slate-400 mb-1">
                    Usuario
                  </label>
                  <select
                    className="input-modern w-full text-sm"
                    value={selectedUsuarioId === '' ? '' : String(selectedUsuarioId)}
                    onChange={(e) =>
                      setSelectedUsuarioId(
                        e.target.value ? Number(e.target.value) : '',
                      )
                    }
                    disabled={usuariosLoading}
                  >
                    <option value="">
                      {usuariosLoading ? 'Cargando usuarios...' : 'Selecciona un usuario'}
                    </option>
                    {usuarios.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre || u.email} {u.rol ? `(${u.rol})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedUsuarioId && (
                <div className="space-y-2">
                  <div className="text-xs text-slate-400">
                    Selecciona los depИsitos a los que el usuario puede acceder.
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {depositos.map((d: any) => {
                      const checked = usuarioDepositoIds.includes(Number(d.id));
                      return (
                        <label
                          key={d.id}
                          className="flex items-center gap-2 text-xs text-slate-200 bg-white/5 border border-white/10 rounded-lg px-2 py-1"
                        >
                          <input
                            type="checkbox"
                            className="rounded border-slate-500"
                            checked={checked}
                            onChange={() => toggleUsuarioDeposito(Number(d.id))}
                          />
                          <span>
                            {d.nombre}
                            {d.codigo ? ` (${d.codigo})` : ''}
                          </span>
                        </label>
                      );
                    })}
                    {!depositos.length && (
                      <div className="text-xs text-slate-500">
                        No hay depИsitos configurados.
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-1">
                <button
                  type="submit"
                  className="h-9 rounded-lg bg-indigo-600 text-white px-4 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={permisosSaving || !selectedUsuarioId}
                >
                  {permisosSaving ? 'Guardando...' : 'Guardar permisos'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
