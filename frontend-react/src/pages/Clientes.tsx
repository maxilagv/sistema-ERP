import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
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
  deuda_anterior_confirmada?: boolean | null;
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

type HistorialPago = {
  id: number;
  tipo: 'pago_venta' | 'pago_cuenta' | 'pago_deuda_inicial' | 'entrega_venta';
  venta_id?: number | null;
  monto?: number | null;
  fecha: string;
  detalle?: string | null;
};

type HistorialCuentaItem = {
  id: string;
  fecha?: string | null;
  tipo: 'pago' | 'compra' | 'entrega' | 'deuda_anterior';
  monto?: number | null;
  detalle?: string | null;
};

type HistorialMovimiento = {
  id: string;
  fecha?: string | null;
  tipo: 'pago_venta' | 'pago_cuenta' | 'pago_deuda_inicial' | 'entrega_venta' | 'deuda_anterior';
  venta_id?: number | null;
  monto?: number | null;
  detalle?: string | null;
  eliminable: boolean;
};

type ClienteAcceso = {
  cliente_id: number;
  email?: string | null;
  has_access: boolean;
  password_set_at?: string | null;
  last_login_at?: string | null;
};

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [deudas, setDeudas] = useState<Record<number, { deuda_pendiente: number, saldo_total: number }>>({});
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [detalleVentas, setDetalleVentas] = useState<VentaCliente[]>([]);
  const [ranking, setRanking] = useState<{ cliente_id: number; total: number }[]>([]);
  const [crmOpps, setCrmOpps] = useState<CrmOportunidad[]>([]);
  const [crmActs, setCrmActs] = useState<CrmActividad[]>([]);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [detalleError, setDetalleError] = useState<string | null>(null);
  const [clienteAcceso, setClienteAcceso] = useState<ClienteAcceso | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [accessSaving, setAccessSaving] = useState(false);
  const [deudasIniciales, setDeudasIniciales] = useState<DeudaInicial[]>([]);
  const [pagosDeudaInicial, setPagosDeudaInicial] = useState<DeudaInicialPago[]>([]);
  const [historialPagos, setHistorialPagos] = useState<HistorialPago[]>([]);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [historialError, setHistorialError] = useState<string | null>(null);


  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [historialDeleting, setHistorialDeleting] = useState(false);
  const [deudaAnteriorForm, setDeudaAnteriorForm] = useState({
    tiene: false,
    monto: '',
  });
  const [pagoDeudaForm, setPagoDeudaForm] = useState({
    monto: '',
    fecha: new Date().toISOString().slice(0, 10),
    detalle: '',
  });
  const [pagoDeudaSaving, setPagoDeudaSaving] = useState(false);
  const [pagoDeudaError, setPagoDeudaError] = useState<string | null>(null);
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
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const CLIENTES_LIMIT = 200;
  const HISTORIAL_LIMIT = 200;
  const searchInitialized = useRef(false);
  const canSubmit = useMemo(() => Boolean(form.nombre), [form]);

  async function loadBase() {
    setError(null);
    try {
      const [deudaRows, topRows] = await Promise.all([
        Api.deudas(),
        Api.topClientes(200).catch(() => []),
      ]);
      const map: Record<number, { deuda_pendiente: number, saldo_total: number }> = {};
      deudaRows.forEach((d: any) => {
        map[d.cliente_id] = {
          deuda_pendiente: Number(d.deuda_pendiente),
          saldo_total: Number(d.saldo_total),
        };
      });
      setDeudas(map);
      setRanking(
        (topRows || []).map((r: any) => ({
          cliente_id: Number(r.cliente_id),
          total: Number(r.total_comprado || 0),
        }))
      );
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar los clientes');
    }
  }

  async function loadClientes(query: string) {
    setLoading(true);
    setError(null);
    try {
      const qValue = query.trim();
      const clis = await Api.clientes({
        q: qValue ? qValue : undefined,
        limit: CLIENTES_LIMIT,
      });
      setClientes(clis as Cliente[]);
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar los clientes');
      setClientes([]);
    } finally {
      setLoading(false);
    }
  }

  async function load() {
    await Promise.all([loadBase(), loadClientes(q)]);
  }

  useEffect(() => {
    load();
  }, []);


  useEffect(() => {
    if (!searchInitialized.current) {
      searchInitialized.current = true;
      return;
    }
    const handle = window.setTimeout(() => {
      loadClientes(q);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [q]);

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
        rankingPosicion: null as number | null,
        rankingTotal: ranking.length,
        saldoTotal: 0,
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
    const deudaObj = deudas[selectedCliente?.id || 0];
    const deudaCorriente = Number(deudaObj?.deuda_pendiente || 0);
    const saldoTotal = Number(deudaObj?.saldo_total || 0);
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
      saldoTotal,
    };
  }, [selectedCliente, detalleVentas, deudas, ranking]);

  const totalDeudaAnterior = useMemo(
    () =>
      deudasIniciales.reduce(
        (acc, d) => acc + (typeof d.monto === 'number' ? d.monto : Number(d.monto || 0)),
        0
      ),
    [deudasIniciales]
  );

  const totalPagosDeudaAnterior = useMemo(
    () =>
      pagosDeudaInicial.reduce(
        (acc, p) => acc + (typeof p.monto === 'number' ? p.monto : Number(p.monto || 0)),
        0
      ),
    [pagosDeudaInicial]
  );

  const saldoDeudaAnterior = useMemo(
    () => Math.max(totalDeudaAnterior - totalPagosDeudaAnterior, 0),
    [totalDeudaAnterior, totalPagosDeudaAnterior]
  );

  const ventasPendientes = useMemo(
    () =>
      detalleVentas.filter(
        (v) =>
          Number(v.saldo_pendiente ?? v.neto ?? v.total ?? 0) > 0 &&
          v.estado_pago !== 'cancelado'
      ),
    [detalleVentas]
  );

  const historialCuenta = useMemo(() => {
    const items: HistorialCuentaItem[] = [];

    for (const d of deudasIniciales) {
      items.push({
        id: `deuda-${d.id}`,
        fecha: d.fecha,
        tipo: 'deuda_anterior',
        monto: Number(d.monto ?? 0),
        detalle: 'Deuda anterior al sistema',
      });
    }

    for (const v of detalleVentas) {
      if (v.estado_pago === 'cancelado') continue;
      const monto = Number(v.neto ?? v.total ?? 0);
      items.push({
        id: `venta-${v.id}`,
        fecha: v.fecha,
        tipo: 'compra',
        monto,
        detalle: `Venta #${v.id}`,
      });
    }

    for (const h of historialPagos) {
      if (h.tipo === 'entrega_venta') {
        items.push({
          id: `entrega-${h.id}`,
          fecha: h.fecha,
          tipo: 'entrega',
          detalle: h.detalle
            ? `Se llevo ${h.detalle}`
            : h.venta_id
              ? `Se llevo venta #${h.venta_id}`
              : 'Se llevo',
        });
        continue;
      }

      const detalle =
        h.tipo === 'pago_deuda_inicial'
          ? 'Deuda anterior'
          : h.venta_id
            ? `Venta #${h.venta_id}`
            : (h.detalle || 'Cuenta corriente');
      items.push({
        id: `pago-${h.id}`,
        fecha: h.fecha,
        tipo: 'pago',
        monto: Number(h.monto ?? 0),
        detalle,
      });
    }

    items.sort((a, b) => {
      const aTime = a.fecha ? new Date(a.fecha).getTime() : 0;
      const bTime = b.fecha ? new Date(b.fecha).getTime() : 0;
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
      if (Number.isNaN(aTime)) return 1;
      if (Number.isNaN(bTime)) return -1;
      return bTime - aTime;
    });

    return items;
  }, [detalleVentas, historialPagos, deudasIniciales]);

  const historialCompleto = useMemo(() => {
    const rows: HistorialMovimiento[] = [];
    for (const d of deudasIniciales) {
      rows.push({
        id: `deuda-${d.id}`,
        tipo: 'deuda_anterior',
        venta_id: null,
        monto: Number(d.monto ?? 0),
        fecha: d.fecha,
        detalle: d.descripcion || 'Deuda anterior al sistema',
        eliminable: false,
      });
    }
    for (const h of historialPagos) {
      rows.push({
        id: `hist-${h.id}`,
        tipo: h.tipo,
        venta_id: h.venta_id ?? null,
        monto: h.monto ?? null,
        fecha: h.fecha,
        detalle: h.detalle ?? null,
        eliminable: h.tipo !== 'entrega_venta',
      });
    }
    rows.sort((a, b) => {
      const aTime = a.fecha ? new Date(a.fecha).getTime() : 0;
      const bTime = b.fecha ? new Date(b.fecha).getTime() : 0;
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
      if (Number.isNaN(aTime)) return 1;
      if (Number.isNaN(bTime)) return -1;
      return bTime - aTime;
    });
    return rows;
  }, [deudasIniciales, historialPagos]);

  function buildClientePayload(cliente: Cliente, extra: Record<string, any> = {}) {
    return {
      nombre: cliente.nombre,
      apellido: cliente.apellido || undefined,
      email: cliente.email || undefined,
      telefono: cliente.telefono || undefined,
      direccion: cliente.direccion || undefined,
      cuit_cuil: cliente.cuit_cuil || undefined,
      tipo_cliente: cliente.tipo_cliente || undefined,
      segmento: cliente.segmento || undefined,
      tags: cliente.tags || undefined,
      estado: cliente.estado || undefined,
      ...extra,
    };
  }

  async function setDeudaAnteriorConfirmada(cliente: Cliente) {
    await Api.actualizarCliente(
      cliente.id,
      buildClientePayload(cliente, { deuda_anterior_confirmada: true })
    );
    setSelectedCliente((prev) =>
      prev ? { ...prev, deuda_anterior_confirmada: true } : prev
    );
    setClientes((prev) =>
      prev.map((c) =>
        c.id === cliente.id ? { ...c, deuda_anterior_confirmada: true } : c
      )
    );
  }

  async function registrarDeudaAnterior(cliente: Cliente) {
    const montoStr = window.prompt('Monto de deuda anterior:', '');
    if (montoStr === null) return;
    const montoNum = Number(montoStr.replace(',', '.'));
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      window.alert('Monto invalido');
      return;
    }
    try {
      await Api.crearDeudaInicialCliente(cliente.id, { monto: montoNum });
      await setDeudaAnteriorConfirmada(cliente);
      const updatedDebts = await Api.clienteDeudasIniciales(cliente.id).catch(() => []);
      setDeudasIniciales((updatedDebts || []) as DeudaInicial[]);
      await loadBase();
    } catch (err: any) {
      window.alert(err?.message || 'No se pudo registrar la deuda anterior');
    }
  }

  async function marcarSinDeudaAnterior(cliente: Cliente) {
    try {
      await setDeudaAnteriorConfirmada(cliente);
    } catch (err: any) {
      window.alert(err?.message || 'No se pudo actualizar el cliente');
    }
  }


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
    setAccessError(null);
    setPagoDeudaError(null);
    try {
      setDeudasIniciales([]);
      setPagosDeudaInicial([]);
      setHistorialPagos([]);
      setHistorialError(null);
      const [ventas, opps, acts, deudasIni, pagosIni, acceso, historial] = await Promise.all([
        Api.ventas({ cliente_id: cliente.id, limit: 200 }),
        Api.oportunidades({ cliente_id: cliente.id, limit: 50 }),
        Api.actividades({ cliente_id: cliente.id, estado: 'pendiente', limit: 50 }),
        Api.clienteDeudasIniciales(cliente.id).catch(() => []),
        Api.clientePagosDeudaInicial(cliente.id).catch(() => []),
        Api.clienteAcceso(cliente.id).catch(() => null),
        Api.clienteHistorialPagos(cliente.id, { limit: HISTORIAL_LIMIT }).catch(() => []),
      ]);
      setDetalleVentas((ventas || []) as VentaCliente[]);
      setCrmOpps((opps || []) as CrmOportunidad[]);
      setCrmActs((acts || []) as CrmActividad[]);
      const deudasInicialesRows = (deudasIni || []) as DeudaInicial[];
      setDeudasIniciales(deudasInicialesRows);
      setPagosDeudaInicial((pagosIni || []) as DeudaInicialPago[]);
      setClienteAcceso((acceso || null) as ClienteAcceso | null);
      setHistorialPagos((historial || []) as HistorialPago[]);

      if (!cliente.deuda_anterior_confirmada && deudasInicialesRows.length) {
        await setDeudaAnteriorConfirmada(cliente);
      }
    } catch (e: any) {
      setDetalleError(e?.message || 'No se pudo cargar el detalle del cliente');
      setDetalleVentas([]);
      setCrmOpps([]);
      setCrmActs([]);
      setDeudasIniciales([]);
      setPagosDeudaInicial([]);
      setHistorialPagos([]);
      setHistorialError(null);
      setClienteAcceso(null);
    } finally {
      setDetalleLoading(false);
    }
  }

  async function loadHistorialPagos() {
    if (!selectedCliente) return;
    setHistorialLoading(true);
    setHistorialError(null);
    try {
      const rows = await Api.clienteHistorialPagos(selectedCliente.id, {
        limit: HISTORIAL_LIMIT,
      });
      setHistorialPagos((rows || []) as HistorialPago[]);
    } catch (e: any) {
      setHistorialError(e?.message || 'No se pudo cargar el historial de pagos');
      setHistorialPagos([]);
    } finally {
      setHistorialLoading(false);
    }
  }

  async function abrirHistorialPagos() {
    if (!selectedCliente) {
      window.alert('Primero selecciona un cliente');
      return;
    }
    setShowHistorialModal(true);
    await loadHistorialPagos();
  }

  async function registrarPagoDeuda() {
    if (!selectedCliente || pagoDeudaSaving) return;
    setPagoDeudaError(null);
    const montoNum = Number(pagoDeudaForm.monto.replace(',', '.'));
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      setPagoDeudaError('Ingresa un monto valido');
      return;
    }
    if (!pagoDeudaForm.detalle?.trim()) {
      setPagoDeudaError('Debes ingresar un motivo / detalle para el pago');
      return;
    }
    setPagoDeudaSaving(true);
    try {
      const fecha = pagoDeudaForm.fecha || undefined;
      await Api.crearPago({
        cliente_id: selectedCliente.id,
        monto: montoNum,
        fecha,
        detalle: pagoDeudaForm.detalle || undefined,
      });
      await verDetalleCliente(selectedCliente);
      await loadBase();
      if (showHistorialModal) {
        await loadHistorialPagos();
      }
      setPagoDeudaForm((prev) => ({ ...prev, monto: '', detalle: '' }));
    } catch (e: any) {
      setPagoDeudaError(e?.message || 'No se pudo registrar el pago');
    } finally {
      setPagoDeudaSaving(false);
    }
  }

  async function eliminarPagoHistorial(item: HistorialPago) {
    if (!selectedCliente || historialDeleting) return;
    if (item.tipo === 'entrega_venta') return;
    if (!window.confirm('?Hubo un inconveniente con un pago?')) return;
    if (!window.confirm('?Deseas eliminarlo? Esta acci?n no se puede deshacer.')) return;
    setHistorialDeleting(true);
    try {
      if (item.tipo === 'pago_venta' || item.tipo === 'pago_cuenta') {
        await Api.eliminarPagoClienteVenta(selectedCliente.id, item.id);
      } else if (item.tipo === 'pago_deuda_inicial') {
        await Api.eliminarPagoClienteDeuda(selectedCliente.id, item.id);
      }
      await verDetalleCliente(selectedCliente);
      await loadBase();
      await loadHistorialPagos();
    } catch (e: any) {
      setHistorialError(e?.message || 'No se pudo eliminar el pago');
    } finally {
      setHistorialDeleting(false);
    }
  }

  function startEditCliente(cliente: Cliente) {
    setEditingCliente(cliente);
    setDeudaAnteriorForm({ tiene: false, monto: '' });
    setForm({
      nombre: cliente.nombre || '',
      apellido: cliente.apellido || '',
      email: cliente.email || '',
      telefono: cliente.telefono || '',
      direccion: cliente.direccion || '',
      cuit_cuil: cliente.cuit_cuil || '',
      tipo_cliente: cliente.tipo_cliente || 'minorista',
      segmento: cliente.segmento || '',
      tags: cliente.tags || '',
    });
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch { }
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

  async function configurarAccesoCliente() {
    if (!selectedCliente || accessSaving) return;
    setAccessError(null);
    const promptMsg = clienteAcceso?.has_access
      ? 'Nueva contrasena para el cliente (dejar vacio para generar una).'
      : 'Contrasena inicial (dejar vacio para generar una).';
    const password = window.prompt(promptMsg, '');
    if (password === null) return;
    setAccessSaving(true);
    try {
      const resp: any = await Api.clienteSetPassword(
        selectedCliente.id,
        password ? { password } : {}
      );
      window.alert(`Contrasena de acceso para ${resp.email}: ${resp.password}`);
      const status = await Api.clienteAcceso(selectedCliente.id);
      setClienteAcceso(status as ClienteAcceso);
    } catch (e: any) {
      setAccessError(e?.message || 'No se pudo configurar el acceso del cliente');
    } finally {
      setAccessSaving(false);
    }
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
            if (!canSubmit) return;
            setError(null);
            if (!editingCliente && deudaAnteriorForm.tiene) {
              const montoNum = Number(deudaAnteriorForm.monto.replace(',', '.'));
              if (!Number.isFinite(montoNum) || montoNum <= 0) {
                setError('Ingresa un monto válido para la deuda anterior');
                return;
              }
            }
            const payload: any = {
              nombre: form.nombre,
              apellido: form.apellido || undefined,
              email: form.email || undefined,
              telefono: form.telefono || undefined,
              direccion: form.direccion || undefined,
              cuit_cuil: form.cuit_cuil || undefined,
              tipo_cliente: form.tipo_cliente || undefined,
              segmento: form.segmento || undefined,
              tags: form.tags || undefined,
              estado: editingCliente?.estado || undefined,
            };
            try {
              if (editingCliente) {
                await Api.actualizarCliente(editingCliente.id, payload);
              } else {
                const created: any = await Api.crearCliente(payload);
                const createdId = Number(created?.id);
                if (deudaAnteriorForm.tiene && Number.isFinite(createdId) && createdId > 0) {
                  const montoNum = Number(deudaAnteriorForm.monto.replace(',', '.'));
                  try {
                    await Api.crearDeudaInicialCliente(createdId, {
                      monto: montoNum,
                    });
                  } catch (err: any) {
                    setError(
                      err?.message ||
                      'Cliente creado, pero no se pudo registrar la deuda anterior'
                    );
                  }
                }
              }
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
              setDeudaAnteriorForm({ tiene: false, monto: '' });
              setEditingCliente(null);
              await load();
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : editingCliente
                    ? 'No se pudo actualizar el cliente'
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
          {!editingCliente && (
            <>
              <label className="md:col-span-6 flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  className="accent-slate-200"
                  checked={deudaAnteriorForm.tiene}
                  onChange={(e) =>
                    setDeudaAnteriorForm((prev) => ({
                      ...prev,
                      tiene: e.target.checked,
                    }))
                  }
                />
                ¿Tiene deuda anterior?
              </label>
              {deudaAnteriorForm.tiene && (
                <input
                  className="input-modern text-sm md:col-span-2"
                  placeholder="Monto deuda anterior"
                  type="number"
                  min="0"
                  step="0.01"
                  value={deudaAnteriorForm.monto}
                  onChange={(e) =>
                    setDeudaAnteriorForm((prev) => ({
                      ...prev,
                      monto: e.target.value,
                    }))
                  }
                />
              )}
            </>
          )}
          <div className="md:col-span-6 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={!canSubmit}>
              {editingCliente ? 'Guardar cambios' : 'Registrar cliente'}
            </Button>
            {editingCliente && (
              <button
                type="button"
                className="h-11 rounded-lg bg-white/5 border border-white/10 text-slate-200 px-4 text-sm"
                onClick={() => {
                  setEditingCliente(null);
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
                  setDeudaAnteriorForm({ tiene: false, monto: '' });
                }}
              >
                Cancelar edicion
              </button>
            )}
          </div>
        </form>
      </div>
      <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="relative w-full md:max-w-sm">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              className="input-modern w-full pl-9"
              placeholder="Buscar por nombre o apellido"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              type="search"
            />
          </div>
          {q ? (
            <button
              type="button"
              className="h-10 rounded-lg bg-white/5 border border-white/10 text-slate-200 px-3 text-xs"
              onClick={() => setQ('')}
            >
              Limpiar
            </button>
          ) : null}
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
                {clientes.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-white/10 hover:bg-white/5"
                  >
                    <td className="py-2">
                      {c.nombre} {c.apellido}
                    </td>
                    <td className="py-2">{c.email || '-'}</td>
                    <td className="py-2">
                      {(() => {
                        const d = deudas[c.id];
                        const saldo = d?.saldo_total || 0;
                        if (saldo < 0) {
                          return (
                            <span className="text-emerald-400 font-medium">
                              - ${Math.abs(saldo).toFixed(2)} (Favor)
                            </span>
                          );
                        }
                        return `$${saldo.toFixed(2)}`;
                      })()}
                    </td>
                    <td className="py-2">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${c.estado === 'activo'
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
                      <button
                        className="px-2 py-1 rounded bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-200 text-xs"
                        onClick={() => startEditCliente(c)}
                      >
                        Editar
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
                {!loading && !clientes.length && (
                  <tr>
                    <td className="py-6 text-center text-slate-400" colSpan={5}>
                      {q ? 'Sin resultados para la busqueda' : 'Sin clientes registrados'}
                    </td>
                  </tr>
                )}
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
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="px-2 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/30 text-sky-200 text-xs"
                onClick={abrirHistorialPagos}
              >
                Historial pagos y entregas
              </button>
              <button
                className="px-2 py-1 rounded bg-slate-500/20 hover:bg-slate-500/30 border border-slate-500/40 text-slate-200 text-xs"
                onClick={() => {
                  setSelectedCliente(null);
                  setDetalleVentas([]);
                  setDetalleError(null);
                  setCrmOpps([]);
                  setCrmActs([]);
                  setClienteAcceso(null);
                  setAccessError(null);
                  setShowHistorialModal(false);
                  setHistorialPagos([]);
                  setHistorialError(null);
                  setPagoDeudaForm({
                    monto: '',
                    fecha: new Date().toISOString().slice(0, 10),
                    detalle: '',
                  });
                  setPagoDeudaError(null);
                }}
              >
                Cerrar
              </button>
            </div>
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
                  {accessError && (
                    <div className="text-xs text-rose-300">{accessError}</div>
                  )}
                  <div>
                    Acceso cliente:{' '}
                    <span className="text-slate-200">
                      {clienteAcceso?.has_access ? 'Activo' : 'Sin acceso'}
                    </span>
                  </div>
                  <div>
                    Email acceso:{' '}
                    <span className="text-slate-200">
                      {clienteAcceso?.email || selectedCliente.email || '-'}
                    </span>
                  </div>
                  {clienteAcceso?.last_login_at && (
                    <div className="text-xs text-slate-400">
                      Ultimo ingreso:{' '}
                      {new Date(clienteAcceso.last_login_at).toLocaleString()}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={configurarAccesoCliente}
                    className="mt-2 px-2 py-1 rounded bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-200 text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={accessSaving}
                  >
                    {accessSaving
                      ? 'Guardando...'
                      : clienteAcceso?.has_access
                        ? 'Resetear contrasena'
                        : 'Crear contrasena'}
                  </button>
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
                    {resumenSeleccionado.saldoTotal < 0 ? (
                      <span className="text-emerald-400 font-medium">
                        - ${Math.abs(resumenSeleccionado.saldoTotal).toFixed(2)} (Favor)
                      </span>
                    ) : (
                      <span className="text-slate-200">
                        ${resumenSeleccionado.deudaCorriente.toFixed(2)}
                      </span>
                    )}
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
              {!selectedCliente.deuda_anterior_confirmada && (
                <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-slate-200">
                  <div className="font-semibold text-slate-100">
                    ?Tiene deuda anterior al sistema?
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-100 text-xs"
                      onClick={() => registrarDeudaAnterior(selectedCliente)}
                    >
                      Si, registrar monto
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 border border-white/20 text-slate-100 text-xs"
                      onClick={() => marcarSinDeudaAnterior(selectedCliente)}
                    >
                      No
                    </button>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-200 mb-2">
                    Cuenta corriente
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs md:text-sm">
                      <thead className="text-left text-slate-400">
                        <tr>
                          <th className="py-1 pr-2">Fecha</th>
                          <th className="py-1 pr-2">Movimiento</th>
                          <th className="py-1 pr-2">Detalle</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-200">
                        {historialCuenta.map((item) => {
                          const montoTexto =
                            typeof item.monto === 'number'
                              ? item.monto.toFixed(2)
                              : null;
                          const movimiento =
                            item.tipo === 'pago'
                              ? `Pago $${montoTexto ?? '0.00'}`
                              : item.tipo === 'compra'
                                ? `Compro $${montoTexto ?? '0.00'}`
                                : item.tipo === 'deuda_anterior'
                                  ? `Deuda $${montoTexto ?? '0.00'}`
                                  : 'Se llevo';
                          return (
                            <tr
                              key={item.id}
                              className="border-t border-white/10 hover:bg-white/5"
                            >
                              <td className="py-1 pr-2">
                                {item.fecha ? new Date(item.fecha).toLocaleDateString() : '-'}
                              </td>
                              <td className="py-1 pr-2">{movimiento}</td>
                              <td className="py-1 pr-2">{item.detalle || '-'}</td>
                            </tr>
                          );
                        })}
                        {!historialCuenta.length && (
                          <tr>
                            <td className="py-2 text-slate-400" colSpan={3}>
                              Sin movimientos registrados
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-200 mb-2">
                    Pago cuenta corriente
                  </h4>
                  {pagoDeudaError && (
                    <div className="text-xs text-rose-300 mb-2">{pagoDeudaError}</div>
                  )}
                  <form
                    className="space-y-3 text-sm"
                    onSubmit={(e) => {
                      e.preventDefault();
                      registrarPagoDeuda();
                    }}
                  >
                    <label className="block">
                      <div className="text-slate-300 mb-1">Monto</div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-sm text-slate-100"
                        value={pagoDeudaForm.monto}
                        onChange={(e) =>
                          setPagoDeudaForm((prev) => ({
                            ...prev,
                            monto: e.target.value,
                          }))
                        }
                        disabled={pagoDeudaSaving}
                      />
                    </label>
                    <label className="block">
                      <div className="text-slate-300 mb-1">Motivo / Detalle</div>
                      <input
                        type="text"
                        className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-sm text-slate-100 placeholder-slate-500"
                        placeholder="Ej: A cuenta, Factura X..."
                        value={pagoDeudaForm.detalle}
                        onChange={(e) =>
                          setPagoDeudaForm((prev) => ({
                            ...prev,
                            detalle: e.target.value,
                          }))
                        }
                        disabled={pagoDeudaSaving}
                      />
                    </label>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 text-emerald-100 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={pagoDeudaSaving || !pagoDeudaForm.monto}
                      >
                        {pagoDeudaSaving ? 'Registrando...' : 'Registrar pago'}
                      </button>
                    </div>
                  </form>

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
      )
      }

      {
        showHistorialModal && selectedCliente && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
            <div className="bg-slate-900 rounded-2xl border border-white/10 shadow-xl w-full max-w-4xl p-4 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm text-slate-400">Historial de pagos y entregas</div>
                  <div className="text-base text-slate-100">
                    Cliente #{selectedCliente.id} - {selectedCliente.nombre}
                    {selectedCliente.apellido ? ` ${selectedCliente.apellido}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 border border-white/20 text-xs"
                  onClick={() => setShowHistorialModal(false)}
                  disabled={historialDeleting}
                >
                  Cerrar
                </button>
              </div>
              {historialError && (
                <div className="text-xs text-rose-300">{historialError}</div>
              )}
              {historialLoading ? (
                <div className="py-6 text-center text-slate-400">Cargando historial...</div>
              ) : (
                <div className="overflow-x-auto text-xs md:text-sm max-h-[60vh]">
                  <table className="min-w-full">
                    <thead className="text-left text-slate-400">
                      <tr>
                        <th className="py-1 pr-2">Fecha</th>
                        <th className="py-1 pr-2">Tipo</th>
                        <th className="py-1 pr-2">Referencia</th>
                        <th className="py-1 pr-2">Monto</th>
                        <th className="py-1 pr-2">Detalle</th>
                        <th className="py-1 pr-2">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-200">
                      {historialCompleto.map((h) => (
                        <tr key={`${h.tipo}-${h.id}`} className="border-t border-white/10 hover:bg-white/5">
                          <td className="py-1 pr-2">
                            {h.fecha ? new Date(h.fecha).toLocaleString() : '-'}
                          </td>
                          <td className="py-1 pr-2">
                            {h.tipo === 'pago_venta'
                              ? 'Pago venta'
                              : h.tipo === 'pago_cuenta'
                                ? 'Pago cuenta corriente'
                                : h.tipo === 'pago_deuda_inicial'
                                  ? 'Pago deuda'
                                  : h.tipo === 'deuda_anterior'
                                    ? 'Deuda anterior'
                                    : 'Entrega'}
                          </td>
                          <td className="py-1 pr-2">
                            {h.tipo === 'pago_venta'
                              ? h.venta_id
                                ? `Venta #${h.venta_id}`
                                : '-'
                              : h.tipo === 'pago_cuenta'
                                ? 'Cuenta corriente'
                                : h.tipo === 'entrega_venta'
                                  ? h.venta_id
                                    ? `Entrega venta #${h.venta_id}`
                                    : 'Entrega'
                                  : h.tipo === 'deuda_anterior'
                                    ? 'Deuda anterior'
                                    : 'Pago deuda'}
                          </td>
                          <td className="py-1 pr-2">
                            {h.monto != null ? `$${Number(h.monto || 0).toFixed(2)}` : '-'}
                          </td>
                          <td className="py-1 pr-2">
                            {h.detalle
                              ? h.tipo === 'entrega_venta'
                                ? `Se entrego ${h.detalle}`
                                : h.detalle
                              : '-'}
                          </td>
                          <td className="py-1 pr-2">
                            {!h.eliminable ? (
                              <span className="text-slate-500">-</span>
                            ) : (
                              <button
                                type="button"
                                className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-200 text-[11px]"
                                onClick={() => {
                                  const base = historialPagos.find((p) => `hist-${p.id}` === h.id);
                                  if (base) eliminarPagoHistorial(base);
                                }}
                                disabled={historialDeleting}
                              >
                                Eliminar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {!historialCompleto.length && (
                        <tr>
                          <td className="py-2 text-slate-400" colSpan={6}>
                            Sin movimientos registrados
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )
      }
    </div >
  )
}
