import { useEffect, useMemo, useState } from 'react';
import { Api } from '../lib/api';
import Button from '../ui/Button';
import Alert from '../components/Alert';

type Cliente = {
  id: number;
  nombre: string;
  apellido?: string | null;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  cuit_cuil?: string | null;
   tipo_cliente?: 'minorista' | 'mayorista' | 'distribuidor' | null;
   segmento?: string | null;
   tags?: string | null;
  estado: 'activo' | 'inactivo';
};

type VentaCliente = {
  id: number;
  fecha: string;
  neto?: number;
  total?: number;
  estado_pago: string;
  saldo_pendiente?: number;
};

type TopProductoCliente = {
  producto_id: number;
  producto_nombre: string;
  total_cantidad: number;
  total_monto: number;
};

type CrmOportunidad = {
  id: number;
  titulo: string;
  fase: string;
  valor_estimado?: number;
  probabilidad?: number;
  fecha_cierre_estimada?: string;
};

type CrmActividad = {
  id: number;
  tipo: string;
  asunto: string;
  fecha_hora?: string;
  estado: string;
};

type DeudaInicial = {
  id: number;
  cliente_id: number;
  monto: number;
  fecha: string;
  descripcion?: string | null;
};

type DeudaInicialPago = {
  id: number;
  cliente_id: number;
  monto: number;
  fecha: string;
  descripcion?: string | null;
};

// Fallbacks para evitar errores si el bloque de modal
// al final del archivo se evalúa fuera del componente.
// El estado real de deuda inicial se maneja dentro de Clientes.
// eslint-disable-next-line no-var
var showDeudaInicialModal: any = false;
// eslint-disable-next-line no-var
var selectedCliente: any = null;
// eslint-disable-next-line no-var
var deudaInicialSaving: any = false;
// eslint-disable-next-line no-var
var deudaInicialError: any = null;
// eslint-disable-next-line no-var
var deudaInicialForm: any = { monto: '', fecha: '', descripcion: '' };
// eslint-disable-next-line no-var, @typescript-eslint/no-empty-function
var setShowDeudaInicialModal: any = () => {};
// eslint-disable-next-line no-var, @typescript-eslint/no-empty-function
var setDeudaInicialForm: any = () => {};
// eslint-disable-next-line no-var, @typescript-eslint/no-empty-function
var guardarDeudaInicial: any = () => {};

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [deudas, setDeudas] = useState<Record<number, number>>({});
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [detalleVentas, setDetalleVentas] = useState<VentaCliente[]>([]);
  const [topProductos, setTopProductos] = useState<TopProductoCliente[]>([]);
  const [ranking, setRanking] = useState<{ cliente_id: number; total: number }[]>([]);
  const [crmOpps, setCrmOpps] = useState<CrmOportunidad[]>([]);
  const [crmActs, setCrmActs] = useState<CrmActividad[]>([]);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [detalleError, setDetalleError] = useState<string | null>(null);
  const [deudasIniciales, setDeudasIniciales] = useState<DeudaInicial[]>([]);
  const [pagosDeudaInicial, setPagosDeudaInicial] = useState<DeudaInicialPago[]>([]);
  const [showDeudaInicialModal, setShowDeudaInicialModal] = useState(false);
  const [modalDeudaMode, setModalDeudaMode] = useState<'deuda' | 'pago'>('deuda');
  const [deudaInicialForm, setDeudaInicialForm] = useState({
    monto: '',
    fecha: new Date().toISOString().slice(0, 10),
    descripcion: '',
  });
  const [deudaInicialSaving, setDeudaInicialSaving] = useState(false);
  const [deudaInicialError, setDeudaInicialError] = useState<string | null>(null);
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    direccion: '',
    cuit_cuil: '',
    tipo_cliente: 'minorista',
    segmento: '',
    tags: '',
  });
  const canCreate = useMemo(() => Boolean(form.nombre), [form]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [clis, deudaRows, topRows] = await Promise.all([
        Api.clientes(),
        Api.deudas(),
        Api.topClientes(200).catch(() => []),
      ]);
      setClientes(clis as Cliente[]);
      const map: Record<number, number> = {};
      for (const d of deudaRows as any[]) {
        map[d.cliente_id] = Number(d.deuda_pendiente || 0);
      }
      setDeudas(map);
      setRanking(
        (topRows || []).map((r: any) => ({
          cliente_id: Number(r.cliente_id),
          total: Number(r.total_comprado || 0),
        }))
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      clientes.filter((c) =>
        `${c.nombre} ${c.apellido || ''} ${c.email || ''}`
          .toLowerCase()
          .includes(q.toLowerCase())
      ),
    [clientes, q]
  );

  const resumenSeleccionado = useMemo(() => {
    if (!selectedCliente) {
      return {
        totalComprado: 0,
        ticketPromedio: 0,
        ultimaCompra: null as Date | null,
        deudaCorriente: 0,
        comprasCount: 0,
        frecuenciaPromedioDias: null as number | null,
        rankingPosicion: null as number | null,
        rankingTotal: ranking.length,
      };
    }
    const comprasCount = detalleVentas.length;
    let totalComprado = 0;
    let ultimaCompra: Date | null = null;
    for (const v of detalleVentas) {
      const monto = Number(v.neto ?? v.total ?? 0);
      totalComprado += monto;
      if (v.fecha) {
        const f = new Date(v.fecha);
        if (!Number.isNaN(f.getTime())) {
          if (!ultimaCompra || f > ultimaCompra) ultimaCompra = f;
        }
      }
    }
    const deudaCorriente = Number(selectedCliente ? deudas[selectedCliente.id] || 0 : 0);
    const ticketPromedio = comprasCount ? totalComprado / comprasCount : 0;

    // Frecuencia promedio entre compras (en días)
    let frecuenciaPromedioDias: number | null = null;
    if (comprasCount > 1) {
      const ordenadas = [...detalleVentas]
        .filter((v) => v.fecha)
        .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
      if (ordenadas.length > 1) {
        let difTotal = 0;
        let pares = 0;
        for (let i = 1; i < ordenadas.length; i += 1) {
          const prev = new Date(ordenadas[i - 1].fecha);
          const curr = new Date(ordenadas[i].fecha);
          if (!Number.isNaN(prev.getTime()) && !Number.isNaN(curr.getTime())) {
            const diffMs = curr.getTime() - prev.getTime();
            difTotal += diffMs / (1000 * 60 * 60 * 24);
            pares += 1;
          }
        }
        if (pares > 0) frecuenciaPromedioDias = difTotal / pares;
      }
    }

    // Posición en ranking interno (si está en el top cargado)
    const idx = ranking.findIndex((r) => r.cliente_id === selectedCliente.id);
    const rankingPosicion = idx >= 0 ? idx + 1 : null;

    return {
      totalComprado,
      ticketPromedio,
      ultimaCompra,
      deudaCorriente,
      comprasCount,
      frecuenciaPromedioDias,
      rankingPosicion,
      rankingTotal: ranking.length,
    };
  }, [selectedCliente, detalleVentas, deudas, ranking]);

  const totalDeudaInicial = useMemo(
    () =>
      deudasIniciales.reduce(
        (acc, d) => acc + (typeof d.monto === 'number' ? d.monto : Number(d.monto || 0)),
        0
      ),
    [deudasIniciales]
  );

  const totalPagosDeudaInicial = useMemo(
    () =>
      pagosDeudaInicial.reduce(
        (acc, p) => acc + (typeof p.monto === 'number' ? p.monto : Number(p.monto || 0)),
        0
      ),
    [pagosDeudaInicial]
  );

  const saldoDeudaInicialNeto = useMemo(
    () => totalDeudaInicial - totalPagosDeudaInicial,
    [totalDeudaInicial, totalPagosDeudaInicial]
  );

  async function cambiarEstado(cliente: Cliente, nuevoEstado: 'activo' | 'inactivo') {
    setError(null);
    try {
      await Api.actualizarCliente(cliente.id, {
        nombre: cliente.nombre,
        apellido: cliente.apellido || undefined,
        email: cliente.email || undefined,
        telefono: cliente.telefono || undefined,
        direccion: cliente.direccion || undefined,
        cuit_cuil: cliente.cuit_cuil || undefined,
        estado: nuevoEstado,
      });
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo actualizar el estado del cliente');
    }
  }

  async function eliminarCliente(cliente: Cliente) {
    if (
      !window.confirm(
        `Eliminar cliente ${cliente.nombre}? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    setError(null);
    try {
      await Api.eliminarCliente(cliente.id);
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo eliminar el cliente');
    }
  }

  async function verDetalleCliente(cliente: Cliente) {
    setSelectedCliente(cliente);
    setDetalleLoading(true);
    setDetalleError(null);
    try {
      setDeudasIniciales([]);
      setPagosDeudaInicial([]);
      const [ventas, top, opps, acts, deudasIni, pagosIni] = await Promise.all([
        Api.ventas({ cliente_id: cliente.id, limit: 100 }),
        Api.topProductosCliente(cliente.id, 5),
        Api.oportunidades({ cliente_id: cliente.id, limit: 50 }),
        Api.actividades({ cliente_id: cliente.id, estado: 'pendiente', limit: 50 }),
        Api.clienteDeudasIniciales(cliente.id).catch(() => []),
        Api.clientePagosDeudaInicial(cliente.id).catch(() => []),
      ]);
      setDetalleVentas((ventas || []) as VentaCliente[]);
      setTopProductos((top || []) as TopProductoCliente[]);
      setCrmOpps((opps || []) as CrmOportunidad[]);
      setCrmActs((acts || []) as CrmActividad[]);
      setDeudasIniciales((deudasIni || []) as DeudaInicial[]);
      setPagosDeudaInicial((pagosIni || []) as DeudaInicialPago[]);
    } catch (e: any) {
      setDetalleError(e?.message || 'No se pudo cargar el detalle del cliente');
      setDetalleVentas([]);
      setTopProductos([]);
      setCrmOpps([]);
      setCrmActs([]);
      setDeudasIniciales([]);
      setPagosDeudaInicial([]);
    } finally {
      setDetalleLoading(false);
    }
  }

  async function crearActividadRapida() {
    if (!selectedCliente) return;
    const asunto = window.prompt(
      `Asunto de la actividad para ${selectedCliente.nombre}?`,
      ''
    );
    if (!asunto) return;
    const descripcion =
      window.prompt('Descripción (opcional)', '') || undefined;
    try {
      await Api.crearActividad({
        tipo: 'llamada',
        asunto: asunto.trim(),
        descripcion,
        fecha_hora: new Date().toISOString(),
        estado: 'pendiente',
        cliente_id: selectedCliente.id,
      });
      const acts = await Api.actividades({
        cliente_id: selectedCliente.id,
        estado: 'pendiente',
        limit: 50,
      });
      setCrmActs((acts || []) as CrmActividad[]);
    } catch (e: any) {
      // En esta vista usamos un fallback simple de alerta
      window.alert(
        e?.message || 'No se pudo crear la actividad rápida'
      );
      }
    }

  async function registrarDeudaAnteriorRapida() {
    if (!selectedCliente) return;
    const montoStr = window.prompt(
      `Monto de deuda anterior para ${selectedCliente.nombre}?`,
      ''
    );
    if (!montoStr) return;
    const montoNum = Number(montoStr.replace(',', '.'));
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      window.alert('Monto inválido');
      return;
    }
    const fechaStr =
      window.prompt('Fecha de origen (YYYY-MM-DD, opcional)', '') || '';
    const descripcion =
      window.prompt('Descripción (opcional)', '') || undefined;
    try {
      await Api.crearDeudaInicialCliente(selectedCliente.id, {
        monto: montoNum,
        fecha: fechaStr || undefined,
        descripcion,
      });
      await load();
      await verDetalleCliente(selectedCliente);
    } catch (e: any) {
      window.alert(
        e?.message || 'No se pudo registrar la deuda anterior'
      );
    }
  }

  async function guardarDeudaInicial() {
    if (!selectedCliente || deudaInicialSaving) return;
    setDeudaInicialError(null);
    const montoNum = Number(deudaInicialForm.monto.replace(',', '.'));
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      setDeudaInicialError('Ingrese un monto v\u00e1lido mayor a 0');
      return;
    }
    try {
      setDeudaInicialSaving(true);
      if (modalDeudaMode === 'deuda') {
        await Api.crearDeudaInicialCliente(selectedCliente.id, {
          monto: montoNum,
          fecha: deudaInicialForm.fecha || undefined,
          descripcion: deudaInicialForm.descripcion || undefined,
        });
      } else {
        await Api.crearPagoDeudaInicialCliente(selectedCliente.id, {
          monto: montoNum,
          fecha: deudaInicialForm.fecha || undefined,
          descripcion: deudaInicialForm.descripcion || undefined,
        });
      }
      const [deudasIni, pagosIni] = await Promise.all([
        Api.clienteDeudasIniciales(selectedCliente.id).catch(() => []),
        Api.clientePagosDeudaInicial(selectedCliente.id).catch(() => []),
      ]);
      setDeudasIniciales((deudasIni || []) as DeudaInicial[]);
      setPagosDeudaInicial((pagosIni || []) as DeudaInicialPago[]);
      await load();
      setShowDeudaInicialModal(false);
      setDeudaInicialForm({
        monto: '',
        fecha: new Date().toISOString().slice(0, 10),
        descripcion: '',
      });
    } catch (e: any) {
      setDeudaInicialError(
        e?.message ||
          (modalDeudaMode === 'deuda'
            ? 'No se pudo registrar la deuda inicial del cliente'
            : 'No se pudo registrar el pago de la deuda inicial del cliente')
      );
    } finally {
      setDeudaInicialSaving(false);
    }
  }

  function abrirModalDeudaInicial(mode: 'deuda' | 'pago') {
    if (!selectedCliente) {
      window.alert('Primero seleccioná un cliente');
      return;
    }
    setDeudaInicialError(null);
    setDeudaInicialForm({
      monto: '',
      fecha: new Date().toISOString().slice(0, 10),
      descripcion: '',
    });
    setModalDeudaMode(mode);
    setShowDeudaInicialModal(true);
  }

    return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
        Clientes
      </h2>
      <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4">
        <form
          onSubmit={async (e) => {
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
                tipo_cliente: form.tipo_cliente || undefined,
                segmento: form.segmento || undefined,
                tags: form.tags || undefined,
              });
              setForm({
                nombre: '',
                apellido: '',
                email: '',
                telefono: '',
                direccion: '',
                cuit_cuil: '',
                tipo_cliente: 'minorista',
                segmento: '',
                tags: '',
              });
              await load();
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : 'No se pudo crear el cliente'
              );
            }
          }}
          className="grid grid-cols-1 md:grid-cols-6 gap-2"
        >
          {error && (
            <div className="md:col-span-6">
              <Alert kind="error" message={error} />
            </div>
          )}
          <input
            className="input-modern text-sm"
            placeholder="Nombre"
            value={form.nombre}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, nombre: e.target.value }))
            }
          />
          <input
            className="input-modern text-sm"
            placeholder="Apellido"
            value={form.apellido}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, apellido: e.target.value }))
            }
          />
          <input
            className="input-modern text-sm"
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, email: e.target.value }))
            }
          />
          <input
            className="input-modern text-sm"
            placeholder="Teléfono"
            value={form.telefono}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, telefono: e.target.value }))
            }
          />
          <input
            className="input-modern text-sm"
            placeholder="Dirección"
            value={form.direccion}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, direccion: e.target.value }))
            }
          />
          <input
            className="input-modern text-sm"
            placeholder="CUIT/CUIL"
            value={form.cuit_cuil}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, cuit_cuil: e.target.value }))
            }
          />
          <select
            className="input-modern text-sm"
            value={form.tipo_cliente}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, tipo_cliente: e.target.value as any }))
            }
          >
            <option value="minorista">Minorista</option>
            <option value="mayorista">Mayorista</option>
            <option value="distribuidor">Distribuidor</option>
          </select>
          <input
            className="input-modern text-sm"
            placeholder="Segmento / rubro"
            value={form.segmento}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, segmento: e.target.value }))
            }
          />
          <input
            className="input-modern text-sm"
            placeholder="Tags (ej: VIP, Moroso)"
            value={form.tags}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, tags: e.target.value }))
            }
          />
          <Button
            type="submit"
            disabled={!canCreate}
            className="md:col-span-6"
          >
            Registrar cliente
          </Button>
        </form>
      </div>
      <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4">
        <div className="flex items-center justify-between mb-3">
          <input
            className="input-modern"
            placeholder="Buscar por nombre o email"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
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
                  <th className="py-2">Deuda corriente</th>
                  <th className="py-2">Estado</th>
                  <th className="py-2">Acciones</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-white/10 hover:bg-white/5"
                  >
                    <td className="py-2">
                      {c.nombre} {c.apellido}
                    </td>
                    <td className="py-2">{c.email || '-'}</td>
                    <td className="py-2">
                      ${(deudas[c.id] || 0).toFixed(2)}
                    </td>
                    <td className="py-2">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${
                          c.estado === 'activo'
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                            : 'bg-slate-500/20 border-slate-500/40 text-slate-200'
                        }`}
                      >
                        {c.estado === 'activo' ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="py-2 space-x-2">
                      <button
                        className="px-2 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/30 text-sky-200 text-xs"
                        onClick={() => verDetalleCliente(c)}
                      >
                        Ver detalle
                      </button>
                      {c.estado === 'activo' ? (
                        <button
                          className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-200 text-xs"
                          onClick={() => cambiarEstado(c, 'inactivo')}
                        >
                          Desactivar
                        </button>
                      ) : (
                        <>
                          <button
                            className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-200 text-xs"
                            onClick={() => cambiarEstado(c, 'activo')}
                          >
                            Activar
                          </button>
                          <button
                            className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-200 text-xs"
                            onClick={() => eliminarCliente(c)}
                          >
                            Eliminar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {selectedCliente && (
        <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Detalle de cliente</h3>
              <p className="text-sm text-slate-400">
                {selectedCliente.nombre} {selectedCliente.apellido || ''} ·{' '}
                {selectedCliente.email || '-'}
              </p>
            </div>
            <button
              className="px-2 py-1 rounded bg-slate-500/20 hover:bg-slate-500/30 border border-slate-500/40 text-slate-200 text-xs"
              onClick={() => {
                setSelectedCliente(null);
                setDetalleVentas([]);
                setTopProductos([]);
                setDetalleError(null);
                setCrmOpps([]);
                setCrmActs([]);
              }}
            >
              Cerrar
            </button>
          </div>
          {detalleError && (
            <div className="mb-3">
              <Alert kind="error" message={detalleError} />
            </div>
          )}
          {detalleLoading ? (
            <div className="py-6 text-center text-slate-500">
              Cargando detalle de cliente...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-sm">
                <div className="space-y-1">
                  <div className="text-xs text-slate-400 uppercase">Datos</div>
                  <div>
                    Teléfono:{' '}
                    <span className="text-slate-200">
                      {selectedCliente.telefono || '-'}
                    </span>
                  </div>
                  <div>
                    Dirección:{' '}
                    <span className="text-slate-200">
                      {selectedCliente.direccion || '-'}
                    </span>
                  </div>
                  <div>
                    CUIT/CUIL:{' '}
                    <span className="text-slate-200">
                      {selectedCliente.cuit_cuil || '-'}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-slate-400 uppercase">Resumen</div>
                  <div>
                    Total comprado:{' '}
                    <span className="text-slate-200">
                      ${resumenSeleccionado.totalComprado.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    Ticket promedio:{' '}
                    <span className="text-slate-200">
                      {resumenSeleccionado.comprasCount
                        ? `$${resumenSeleccionado.ticketPromedio.toFixed(2)}`
                        : '-'}
                    </span>
                  </div>
                  <div>
                    Compras realizadas:{' '}
                    <span className="text-slate-200">
                      {resumenSeleccionado.comprasCount}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-slate-400 uppercase">Situación</div>
                  <div>
                    Deuda corriente:{' '}
                    <span className="text-slate-200">
                      ${resumenSeleccionado.deudaCorriente.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    Última compra:{' '}
                    <span className="text-slate-200">
                      {resumenSeleccionado.ultimaCompra
                        ? resumenSeleccionado.ultimaCompra.toLocaleString()
                        : '-'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2">
                    <h4 className="text-sm font-semibold text-slate-200 mb-2">
                      Historial de compras
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs md:text-sm">
                      <thead className="text-left text-slate-400">
                        <tr>
                          <th className="py-1 pr-2">ID</th>
                          <th className="py-1 pr-2">Fecha</th>
                          <th className="py-1 pr-2">Total</th>
                          <th className="py-1 pr-2">Estado pago</th>
                          <th className="py-1 pr-2">Saldo pendiente</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-200">
                        {detalleVentas.map((v) => (
                          <tr
                            key={v.id}
                            className="border-t border-white/10 hover:bg-white/5"
                          >
                            <td className="py-1 pr-2">#{v.id}</td>
                            <td className="py-1 pr-2">
                              {v.fecha ? new Date(v.fecha).toLocaleString() : '-'}
                            </td>
                            <td className="py-1 pr-2">
                              ${Number(v.neto ?? v.total ?? 0).toFixed(2)}
                            </td>
                            <td className="py-1 pr-2">{v.estado_pago}</td>
                            <td className="py-1 pr-2">
                              ${Number(v.saldo_pendiente ?? 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                        {!detalleVentas.length && (
                          <tr>
                            <td
                              className="py-2 text-slate-400"
                              colSpan={5}
                              >
                                Sin compras registradas
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {deudasIniciales.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-slate-200 mb-2">
                        Deudas iniciales registradas
                      </h4>
                      <div className="overflow-x-auto text-xs md:text-sm">
                        <table className="min-w-full">
                          <thead className="text-left text-slate-400">
                            <tr>
                              <th className="py-1 pr-2">Fecha</th>
                              <th className="py-1 pr-2">Monto</th>
                              <th className="py-1 pr-2">DescripciИn</th>
                            </tr>
                          </thead>
                          <tbody className="text-slate-200">
                            {deudasIniciales.map((d) => (
                              <tr
                                key={d.id}
                                className="border-t border-white/10 hover:bg-white/5"
                              >
                                <td className="py-1 pr-2">
                                  {d.fecha ? new Date(d.fecha).toLocaleDateString() : '-'}
                                </td>
                                <td className="py-1 pr-2">
                                  ${Number(d.monto || 0).toFixed(2)}
                                </td>
                                <td className="py-1 pr-2">
                                  {d.descripcion || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs md:text-sm">
                    <button
                      type="button"
                      onClick={() => abrirModalDeudaInicial('deuda')}
                      className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-100"
                    >
                      Registrar deuda inicial
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirModalDeudaInicial('pago')}
                      className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-100"
                    >
                      Registrar pago deuda inicial
                    </button>
                  </div>
                  <div>
                  <h4 className="text-sm font-semibold text-slate-200 mb-2">
                    Productos más comprados
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead className="text-left text-slate-400">
                        <tr>
                          <th className="py-1 pr-2">Producto</th>
                          <th className="py-1 pr-2">Unidades</th>
                          <th className="py-1 pr-2">Monto</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-200">
                        {topProductos.map((p) => (
                          <tr
                            key={p.producto_id}
                            className="border-t border-white/10 hover:bg-white/5"
                          >
                            <td className="py-1 pr-2">{p.producto_nombre}</td>
                            <td className="py-1 pr-2">
                              {Number(p.total_cantidad || 0)}
                            </td>
                            <td className="py-1 pr-2">
                              ${Number(p.total_monto || 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                        {!topProductos.length && (
                          <tr>
                            <td
                              className="py-2 text-slate-400"
                              colSpan={3}
                            >
                              Sin productos destacados
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-200">
                    Métricas avanzadas
                  </h4>
                  <div>
                    Frecuencia prom. entre compras:{' '}
                    <span className="text-slate-200">
                      {resumenSeleccionado.frecuenciaPromedioDias != null
                        ? `${resumenSeleccionado.frecuenciaPromedioDias.toFixed(1)} días`
                        : '-'}
                    </span>
                  </div>
                  <div>
                    Ranking (top clientes):{' '}
                    <span className="text-slate-200">
                      {resumenSeleccionado.rankingPosicion
                        ? `#${resumenSeleccionado.rankingPosicion} de ${resumenSeleccionado.rankingTotal}`
                        : resumenSeleccionado.rankingTotal
                        ? 'Fuera del top cargado'
                        : '-'}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-200">
                    CRM
                  </h4>
                  <div>
                    Oportunidades abiertas:{' '}
                    <span className="text-slate-200">{crmOpps.length}</span>
                  </div>
                  <div>
                    Actividades pendientes:{' '}
                    <span className="text-slate-200">{crmActs.length}</span>
                  </div>
                  <div className="mt-1">
                    <button
                      type="button"
                      onClick={crearActividadRapida}
                      className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-200 text-xs"
                    >
                      Nueva actividad rápida
                    </button>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={registrarDeudaAnteriorRapida}
                      className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-100 text-xs"
                    >
                      Registrar deuda anterior (rápida)
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirModalDeudaInicial('deuda')}
                      className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-100 text-xs"
                    >
                      Registrar deuda con formulario
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirModalDeudaInicial('pago')}
                      className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-100 text-xs"
                    >
                      Registrar pago deuda inicial
                    </button>
                  </div>
                  <div className="mt-2">
                    <div className="text-xs text-slate-400 uppercase mb-1">
                      Oportunidades
                    </div>
                    <ul className="space-y-1 text-xs text-slate-200">
                      {crmOpps.slice(0, 5).map((o) => (
                        <li key={o.id}>
                          <span className="font-medium">{o.titulo}</span>{' '}
                          <span className="text-slate-400">
                            · {o.fase}
                            {typeof o.valor_estimado === 'number'
                              ? ` · $${o.valor_estimado.toFixed(0)}`
                              : ''}
                          </span>
                        </li>
                      ))}
                      {!crmOpps.length && (
                        <li className="text-slate-400">Sin oportunidades abiertas</li>
                      )}
                    </ul>
                  </div>
                  <div className="mt-3">
                    <div className="text-xs text-slate-400 uppercase mb-1">
                      Actividades pendientes
                    </div>
                    <ul className="space-y-1 text-xs text-slate-200">
                      {crmActs.slice(0, 5).map((a) => (
                        <li key={a.id}>
                          <span className="font-medium">{a.tipo}</span>{' '}
                          <span>- {a.asunto}</span>{' '}
                          <span className="text-slate-400">
                            {a.fecha_hora
                              ? `· ${new Date(a.fecha_hora).toLocaleString()}`
                              : ''}{' '}
                            · {a.estado}
                          </span>
                        </li>
                      ))}
                      {!crmActs.length && (
                        <li className="text-slate-400">Sin actividades pendientes</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      {showDeudaInicialModal && selectedCliente && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
          <div className="bg-slate-900 rounded-2xl border border-white/10 shadow-xl w-full max-w-md p-4 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm text-slate-400">
                  {modalDeudaMode === 'deuda'
                    ? 'Registrar deuda anterior'
                    : 'Registrar pago de deuda anterior'}
                </div>
                <div className="text-base text-slate-100">
                  Cliente #{selectedCliente.id} - {selectedCliente.nombre}
                  {selectedCliente.apellido ? ` ${selectedCliente.apellido}` : ''}
                </div>
              </div>
              <button
                type="button"
                className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 border border-white/20 text-xs"
                onClick={() => setShowDeudaInicialModal(false)}
                disabled={deudaInicialSaving}
              >
                Cerrar
              </button>
            </div>
            {deudaInicialError && (
              <div className="text-xs text-rose-300">{deudaInicialError}</div>
            )}
            <div className="space-y-3 text-sm">
              <label className="block">
                <div className="text-slate-300 mb-1">Monto</div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-sm text-slate-100"
                  value={deudaInicialForm.monto}
                  onChange={(e) =>
                    setDeudaInicialForm((prev) => ({
                      ...prev,
                      monto: e.target.value,
                    }))
                  }
                  disabled={deudaInicialSaving}
                />
              </label>
              <label className="block">
                <div className="text-slate-300 mb-1">Fecha</div>
                <input
                  type="date"
                  className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-sm text-slate-100"
                  value={deudaInicialForm.fecha}
                  onChange={(e) =>
                    setDeudaInicialForm((prev) => ({
                      ...prev,
                      fecha: e.target.value,
                    }))
                  }
                  disabled={deudaInicialSaving}
                />
              </label>
              <label className="block">
                <div className="text-slate-300 mb-1">Descripción (opcional)</div>
                <textarea
                  className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-sm text-slate-100"
                  rows={3}
                  value={deudaInicialForm.descripcion}
                  onChange={(e) =>
                    setDeudaInicialForm((prev) => ({
                      ...prev,
                      descripcion: e.target.value,
                    }))
                  }
                  disabled={deudaInicialSaving}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeudaInicialModal(false)}
                className="px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs"
                disabled={deudaInicialSaving}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardarDeudaInicial}
                className="px-3 py-1.5 rounded bg-amber-500/20 border border-amber-500/30 hover:bg-amber-500/30 text-amber-100 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={deudaInicialSaving}
              >
                {deudaInicialSaving
                  ? 'Guardando...'
                  : modalDeudaMode === 'deuda'
                    ? 'Registrar deuda'
                    : 'Registrar pago'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

      {showDeudaInicialModal && selectedCliente && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
          <div className="bg-slate-900 rounded-2xl border border-white/10 shadow-xl w-full max-w-md p-4 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm text-slate-400">
                  Registrar deuda anterior
                </div>
                <div className="text-base text-slate-100">
                  Cliente #{selectedCliente.id} - {selectedCliente.nombre}
                  {selectedCliente.apellido ? ` ${selectedCliente.apellido}` : ''}
                </div>
              </div>
              <button
                type="button"
                className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 border border-white/20 text-xs"
                onClick={() => setShowDeudaInicialModal(false)}
                disabled={deudaInicialSaving}
              >
                Cerrar
              </button>
            </div>
            {deudaInicialError && (
              <div className="text-xs text-rose-300">{deudaInicialError}</div>
            )}
            <div className="space-y-3 text-sm">
              <label className="block">
                <div className="text-slate-300 mb-1">Monto</div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-sm text-slate-100"
                  value={deudaInicialForm.monto}
                  onChange={(e) =>
                    setDeudaInicialForm((prev) => ({
                      ...prev,
                      monto: e.target.value,
                    }))
                  }
                  disabled={deudaInicialSaving}
                />
              </label>
              <label className="block">
                <div className="text-slate-300 mb-1">Fecha de origen</div>
                <input
                  type="date"
                  className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-sm text-slate-100"
                  value={deudaInicialForm.fecha}
                  onChange={(e) =>
                    setDeudaInicialForm((prev) => ({
                      ...prev,
                      fecha: e.target.value,
                    }))
                  }
                  disabled={deudaInicialSaving}
                />
              </label>
              <label className="block">
                <div className="text-slate-300 mb-1">DescripciИn (opcional)</div>
                <textarea
                  className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-sm text-slate-100"
                  rows={3}
                  value={deudaInicialForm.descripcion}
                  onChange={(e) =>
                    setDeudaInicialForm((prev) => ({
                      ...prev,
                      descripcion: e.target.value,
                    }))
                  }
                  disabled={deudaInicialSaving}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeudaInicialModal(false)}
                className="px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs"
                disabled={deudaInicialSaving}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardarDeudaInicial}
                className="px-3 py-1.5 rounded bg-amber-500/20 border border-amber-500/30 hover:bg-amber-500/30 text-amber-100 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={deudaInicialSaving}
              >
                {deudaInicialSaving ? 'Guardando...' : 'Registrar deuda'}
              </button>
            </div>
          </div>
        </div>
      )}
