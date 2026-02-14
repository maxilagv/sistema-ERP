import { useCallback, useEffect, useMemo, useState } from 'react';
import { Api } from '../lib/api';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

type PeriodKey = '24h' | '7d' | '30d' | 'custom';
type TabKey =
  | 'costos'
  | 'bruta'
  | 'neta'
  | 'producto'
  | 'categorias'
  | 'clientes'
  | 'cobranzas'
  | 'pagos'
  | 'cashflow'
  | 'presupuestos'
  | 'simulador';

type SerieGananciaNeta = {
  fecha: string;
  totalVentas: number;
  totalCostoProductos: number;
  totalGastos: number;
  totalInversiones: number;
  gananciaBruta: number;
  gananciaNeta: number;
};

type SerieGananciaBruta = {
  fecha: string;
  totalVentas: number;
};

type IngresoBrutoProducto = {
  productoId: number | null;
  productoCodigo: string;
  productoNombre: string;
  unidadesVendidas: number;
  ingresosBrutos: number;
};

type DetalleGananciaPorProducto = {
  productoId: number;
  productoCodigo: string;
  productoNombre: string;
  unidadesVendidas: number;
  ingresos: number;
  costoTotal: number;
  gananciaBruta: number;
  margenPorcentaje: number | null;
};

type DetalleCostosProducto = {
  productoId: number;
  productoCodigo: string;
  productoNombre: string;
  moneda: string;
  cantidad: number;
  totalCostos: number;
};

type DetalleRentabilidadCategoria = {
  categoriaId: number | null;
  categoriaNombre: string;
  unidadesVendidas: number;
  ingresos: number;
  costoTotal: number;
  gananciaBruta: number;
  margenPorcentaje: number | null;
};

type DetalleRentabilidadCliente = {
  clienteId: number;
  clienteNombre: string;
  clienteApellido: string;
  unidadesVendidas: number;
  ingresos: number;
  costoTotal: number;
  gananciaBruta: number;
  margenPorcentaje: number | null;
  deuda: number;
};

type DeudaClienteResumen = {
  clienteId: number;
  clienteNombre: string;
  clienteApellido: string;
  deudaTotal: number;
  deuda0_30: number;
  deuda31_60: number;
  deuda61_90: number;
  deudaMas90: number;
  diasPromedioAtraso: number | null;
};

type VentaPendiente = {
  ventaId: number;
  fecha: string;
  neto: number;
  totalPagado: number;
  saldo: number;
  dias: number;
};

type DeudaProveedorResumen = {
  proveedorId: number;
  proveedorNombre: string;
  deudaTotal: number;
  deuda0_30: number;
  deuda31_60: number;
  deuda61_90: number;
  deudaMas90: number;
  diasPromedioAtraso: number | null;
};

type PuntoCashflow = {
  fecha: string;
  entradas: number;
  salidas: number;
  saldoAcumulado: number;
};

type PresupuestoRow = {
  id?: number;
  anio: number;
  mes: number;
  tipo: string;
  categoria: string;
  monto: number;
};

type PresupuestoVsRealRow = {
  tipo: string;
  categoria: string;
  presupuesto: number;
  real: number;
  diferencia: number;
};

type SimuladorResultado = {
  periodoDias: number;
  actual: {
    totalVentas: number;
    totalCosto: number;
    totalGastos: number;
    gananciaBruta: number;
    gananciaNeta: number;
  };
  simulado: {
    totalVentas: number;
    totalCosto: number;
    totalGastos: number;
    gananciaBruta: number;
    gananciaNeta: number;
  };
};

const PIE_COLORS = [
  '#0ea5e9',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#14b8a6',
  '#f97316',
  '#84cc16',
  '#6366f1',
  '#d946ef',
];

function computeRange(period: PeriodKey, desde: string, hasta: string): { desde: string; hasta: string } | null {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  if (period === '24h') {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return { desde: d.toISOString().slice(0, 10), hasta: todayStr };
  }
  if (period === '7d') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { desde: d.toISOString().slice(0, 10), hasta: todayStr };
  }
  if (period === '30d') {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    return { desde: d.toISOString().slice(0, 10), hasta: todayStr };
  }
  if (!desde || !hasta) return null;
  return { desde, hasta };
}

export default function Finanzas() {
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [customDesde, setCustomDesde] = useState<string>('');
  const [customHasta, setCustomHasta] = useState<string>('');
  const [tab, setTab] = useState<TabKey>('neta');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [serieNeta, setSerieNeta] = useState<SerieGananciaNeta[]>([]);
  const [serieBruta, setSerieBruta] = useState<SerieGananciaBruta[]>([]);
  const [ingresosBrutosProductos, setIngresosBrutosProductos] = useState<IngresoBrutoProducto[]>([]);
  const [totalIngresosBrutos, setTotalIngresosBrutos] = useState<number>(0);
  const [productosRentables, setProductosRentables] = useState<DetalleGananciaPorProducto[]>([]);
  const [costosProductos, setCostosProductos] = useState<DetalleCostosProducto[]>([]);
  const [rentabilidadCategorias, setRentabilidadCategorias] = useState<DetalleRentabilidadCategoria[]>([]);
  const [rentabilidadClientes, setRentabilidadClientes] = useState<DetalleRentabilidadCliente[]>([]);
  const [deudasClientesResumen, setDeudasClientesResumen] = useState<DeudaClienteResumen[]>([]);
  const [clienteDeudaSeleccionado, setClienteDeudaSeleccionado] = useState<number | null>(null);
  const [ventasPendientesCliente, setVentasPendientesCliente] = useState<VentaPendiente[]>([]);
  const [deudasProveedoresResumen, setDeudasProveedoresResumen] = useState<DeudaProveedorResumen[]>([]);
  const [diasPromedioPagoProveedores, setDiasPromedioPagoProveedores] = useState<number | null>(null);
  const [cashflowSerie, setCashflowSerie] = useState<PuntoCashflow[]>([]);
  const [saldoInicial, setSaldoInicial] = useState<number>(0);
  const [saldoMinimo, setSaldoMinimo] = useState<number>(0);
  const [saldoMaximo, setSaldoMaximo] = useState<number>(0);
  const [diasPorDebajoUmbral, setDiasPorDebajoUmbral] = useState<number>(0);
  const [umbralMinimo, setUmbralMinimo] = useState<number>(0);

  const now = new Date();
  const [presupuestoAnio, setPresupuestoAnio] = useState<number>(now.getFullYear());
  const [presupuestoMes, setPresupuestoMes] = useState<number>(now.getMonth() + 1);
  const [presupuestosMes, setPresupuestosMes] = useState<PresupuestoRow[]>([]);
  const [presupuestoVsRealRows, setPresupuestoVsRealRows] = useState<PresupuestoVsRealRow[]>([]);
  const [presupuestoForm, setPresupuestoForm] = useState({
    tipo: 'ventas',
    categoria: 'TOTAL',
    monto: '',
  });
  const [savingPresupuesto, setSavingPresupuesto] = useState(false);
  const [simuladorForm, setSimuladorForm] = useState({
    periodoDias: 30,
    aumentoPrecios: 0,
    aumentoCostos: 0,
    aumentoGastos: 0,
  });
  const [simuladorResultado, setSimuladorResultado] = useState<SimuladorResultado | null>(null);
  const [simuladorLoading, setSimuladorLoading] = useState(false);

  const range = useMemo(() => computeRange(period, customDesde, customHasta), [period, customDesde, customHasta]);

  useEffect(() => {
    if (!range) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [netaRes, brutaRes, ingresosRes, prodRes, costosRes, catsRes, clientesRes, cashflowRes] = await Promise.all([
          Api.gananciaNeta({ desde: range.desde, hasta: range.hasta }),
          Api.gananciaBruta({ desde: range.desde, hasta: range.hasta, agregado: 'dia' }),
          Api.ingresosBrutosProductos({ desde: range.desde, hasta: range.hasta, limit: 10 }),
          Api.gananciaPorProducto({ desde: range.desde, hasta: range.hasta, limit: 20, orderBy: 'ganancia' }),
          Api.costosProductos({ desde: range.desde, hasta: range.hasta, groupBy: 'producto' }),
          Api.rentabilidadPorCategoria({ desde: range.desde, hasta: range.hasta, limit: 20 }),
          Api.rentabilidadPorCliente({ desde: range.desde, hasta: range.hasta, limit: 20 }),
          Api.cashflow({ desde: range.desde, hasta: range.hasta, agrupado: 'dia' }),
        ]);

        setSerieNeta(
          (netaRes?.serie || []).map((r: any) => ({
            fecha: r.fecha,
            totalVentas: Number(r.totalVentas || 0),
            totalCostoProductos: Number(r.totalCostoProductos || 0),
            totalGastos: Number(r.totalGastos || 0),
            totalInversiones: Number(r.totalInversiones || 0),
            gananciaBruta: Number(r.gananciaBruta || 0),
            gananciaNeta: Number(r.gananciaNeta || 0),
          }))
        );

        setSerieBruta(
          (brutaRes?.serie || []).map((r: any) => ({
            fecha: r.fecha,
            totalVentas: Number(r.totalVentas || 0),
          }))
        );

        setIngresosBrutosProductos(
          (ingresosRes?.items || []).map((r: any) => ({
            productoId: r.productoId ?? null,
            productoCodigo: r.productoCodigo,
            productoNombre: r.productoNombre,
            unidadesVendidas: Number(r.unidadesVendidas || 0),
            ingresosBrutos: Number(r.ingresosBrutos || 0),
          }))
        );
        setTotalIngresosBrutos(Number(ingresosRes?.totalIngresosBrutos || 0));

        setProductosRentables(
          (prodRes?.items || []).map((r: any) => ({
            productoId: r.productoId,
            productoCodigo: r.productoCodigo,
            productoNombre: r.productoNombre,
            unidadesVendidas: Number(r.unidadesVendidas || 0),
            ingresos: Number(r.ingresos || 0),
            costoTotal: Number(r.costoTotal || 0),
            gananciaBruta: Number(r.gananciaBruta || 0),
            margenPorcentaje: r.margenPorcentaje != null ? Number(r.margenPorcentaje) : null,
          }))
        );

        setCostosProductos(
          (costosRes?.detalles || []).map((r: any) => ({
            productoId: r.productoId,
            productoCodigo: r.productoCodigo,
            productoNombre: r.productoNombre,
            moneda: r.moneda,
            cantidad: Number(r.cantidad || 0),
            totalCostos: Number(r.totalCostos || 0),
          }))
        );

        setRentabilidadCategorias(
          (catsRes?.items || []).map((r: any) => ({
            categoriaId: r.categoriaId ?? null,
            categoriaNombre: r.categoriaNombre,
            unidadesVendidas: Number(r.unidadesVendidas || 0),
            ingresos: Number(r.ingresos || 0),
            costoTotal: Number(r.costoTotal || 0),
            gananciaBruta: Number(r.gananciaBruta || 0),
            margenPorcentaje: r.margenPorcentaje != null ? Number(r.margenPorcentaje) : null,
          }))
        );

        setRentabilidadClientes(
          (clientesRes?.items || []).map((r: any) => ({
            clienteId: r.clienteId,
            clienteNombre: r.clienteNombre,
            clienteApellido: r.clienteApellido,
            unidadesVendidas: Number(r.unidadesVendidas || 0),
            ingresos: Number(r.ingresos || 0),
            costoTotal: Number(r.costoTotal || 0),
            gananciaBruta: Number(r.gananciaBruta || 0),
            margenPorcentaje: r.margenPorcentaje != null ? Number(r.margenPorcentaje) : null,
            deuda: Number(r.deuda || 0),
          }))
        );

        setCashflowSerie(
          (cashflowRes?.serie || []).map((r: any) => ({
            fecha: r.fecha,
            entradas: Number(r.entradas || 0),
            salidas: Number(r.salidas || 0),
            saldoAcumulado: Number(r.saldoAcumulado || 0),
          }))
        );
        setSaldoInicial(Number(cashflowRes?.saldoInicial || 0));
        setSaldoMinimo(Number(cashflowRes?.saldoMinimo || 0));
        setSaldoMaximo(Number(cashflowRes?.saldoMaximo || 0));
        setDiasPorDebajoUmbral(Number(cashflowRes?.diasPorDebajoUmbral || 0));
        setUmbralMinimo(Number(cashflowRes?.umbralMinimo || 0));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudieron cargar los datos de finanzas');
        setSerieNeta([]);
        setSerieBruta([]);
        setIngresosBrutosProductos([]);
        setTotalIngresosBrutos(0);
        setProductosRentables([]);
        setCostosProductos([]);
        setRentabilidadCategorias([]);
        setRentabilidadClientes([]);
        setCashflowSerie([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [range?.desde, range?.hasta]);

  // Cargar deudas de clientes y proveedores (estado al día de hoy)
  useEffect(() => {
    (async () => {
      try {
        const [cliRes, provRes] = await Promise.all([
          Api.deudasClientes().catch(() => []),
          Api.deudasProveedores().catch(() => ({ items: [], diasPromedioPagoGlobal: null })),
        ]);

        const cliItems = Array.isArray(cliRes) ? cliRes : [];
        setDeudasClientesResumen(
          cliItems.map((c: any) => ({
            clienteId: c.clienteId,
            clienteNombre: c.clienteNombre,
            clienteApellido: c.clienteApellido,
            deudaTotal: Number(c.deudaTotal || 0),
            deuda0_30: Number(c.deuda0_30 || 0),
            deuda31_60: Number(c.deuda31_60 || 0),
            deuda61_90: Number(c.deuda61_90 || 0),
            deudaMas90: Number(c.deudaMas90 || 0),
            diasPromedioAtraso:
              c.diasPromedioAtraso != null ? Number(c.diasPromedioAtraso) : null,
          }))
        );

        const provObj = provRes as any;
        const itemsProv = Array.isArray(provObj?.items) ? provObj.items : [];
        setDeudasProveedoresResumen(
          itemsProv.map((p: any) => ({
            proveedorId: p.proveedorId,
            proveedorNombre: p.proveedorNombre,
            deudaTotal: Number(p.deudaTotal || 0),
            deuda0_30: Number(p.deuda0_30 || 0),
            deuda31_60: Number(p.deuda31_60 || 0),
            deuda61_90: Number(p.deuda61_90 || 0),
            deudaMas90: Number(p.deudaMas90 || 0),
            diasPromedioAtraso:
              p.diasPromedioAtraso != null ? Number(p.diasPromedioAtraso) : null,
          }))
        );
        setDiasPromedioPagoProveedores(
          provObj?.diasPromedioPagoGlobal != null
            ? Number(provObj.diasPromedioPagoGlobal)
            : null
        );
      } catch {
        setDeudasClientesResumen([]);
        setDeudasProveedoresResumen([]);
        setDiasPromedioPagoProveedores(null);
      }
    })();
  }, []);

  const cargarPresupuestosMes = useCallback(async () => {
    try {
      const [presRes, vsRealRes] = await Promise.all([
        Api.presupuestos({ anio: presupuestoAnio, mes: presupuestoMes }).catch(() => []),
        Api.presupuestoVsReal({ anio: presupuestoAnio, mes: presupuestoMes }).catch(
          () => ({ items: [] })
        ),
      ]);

      setPresupuestosMes(
        (presRes as any[]).map((p) => ({
          id: p.id,
          anio: Number(p.anio || presupuestoAnio),
          mes: Number(p.mes || presupuestoMes),
          tipo: p.tipo,
          categoria: p.categoria,
          monto: Number(p.monto || 0),
        }))
      );

      setPresupuestoVsRealRows(
        ((vsRealRes as any)?.items || []).map((r: any) => ({
          tipo: r.tipo,
          categoria: r.categoria,
          presupuesto: Number(r.presupuesto || 0),
          real: Number(r.real || 0),
          diferencia: Number(r.diferencia || 0),
        }))
      );
    } catch {
      setPresupuestosMes([]);
      setPresupuestoVsRealRows([]);
    }
  }, [presupuestoAnio, presupuestoMes]);

  // Cargar presupuestos y presupuesto vs real para el mes seleccionado
  useEffect(() => {
    cargarPresupuestosMes();
  }, [cargarPresupuestosMes]);

  useEffect(() => {
    if (clienteDeudaSeleccionado == null) {
      setVentasPendientesCliente([]);
      return;
    }
    (async () => {
      try {
        const res = (await Api.deudasClientes({
          clienteId: clienteDeudaSeleccionado,
          detalle: true,
        })) as any;
        const ventas = Array.isArray(res?.ventas) ? res.ventas : [];
        setVentasPendientesCliente(
          ventas.map((v: any) => ({
            ventaId: Number(v.ventaId),
            fecha: v.fecha,
            neto: Number(v.neto || 0),
            totalPagado: Number(v.totalPagado || 0),
            saldo: Number(v.saldo || 0),
            dias: Number(v.dias || 0),
          }))
        );
      } catch {
        setVentasPendientesCliente([]);
      }
    })();
  }, [clienteDeudaSeleccionado]);

  async function guardarPresupuesto() {
    setFeedback(null);
    const monto = Number(presupuestoForm.monto);
    if (!presupuestoForm.categoria.trim()) {
      setFeedback('Categoria requerida');
      return;
    }
    if (!Number.isFinite(monto) || monto < 0) {
      setFeedback('Monto invalido');
      return;
    }
    setSavingPresupuesto(true);
    try {
      await Api.guardarPresupuesto({
        anio: presupuestoAnio,
        mes: presupuestoMes,
        tipo: presupuestoForm.tipo,
        categoria: presupuestoForm.categoria.trim(),
        monto,
      });
      setPresupuestoForm((prev) => ({ ...prev, monto: '' }));
      await cargarPresupuestosMes();
      setFeedback('Presupuesto guardado');
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSavingPresupuesto(false);
    }
  }

  async function eliminarPresupuestoRow(id?: number) {
    if (!id) return;
    try {
      await Api.eliminarPresupuesto(id);
      await cargarPresupuestosMes();
      setFeedback('Presupuesto eliminado');
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : 'No se pudo eliminar');
    }
  }

  async function ejecutarSimulador() {
    setSimuladorLoading(true);
    setFeedback(null);
    try {
      const res = (await Api.simuladorFinanciero(simuladorForm)) as SimuladorResultado;
      setSimuladorResultado(res);
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : 'No se pudo ejecutar simulador');
      setSimuladorResultado(null);
    } finally {
      setSimuladorLoading(false);
    }
  }

  const chartGananciaNeta = useMemo(
    () =>
      serieNeta.map((r) => ({
        fecha: new Date(r.fecha).toLocaleDateString(undefined, { month: 'short', day: '2-digit' }),
        ventas: r.totalVentas,
        costo: r.totalCostoProductos,
        gastos: r.totalGastos + r.totalInversiones,
        neta: r.gananciaNeta,
      })),
    [serieNeta]
  );

    const chartGananciaBruta = useMemo(
      () =>
        serieBruta.map((r) => ({
          fecha: new Date(r.fecha).toLocaleDateString(undefined, { month: 'short', day: '2-digit' }),
          ventas: r.totalVentas,
        })),
      [serieBruta]
    );

    const chartCashflow = useMemo(
      () =>
        cashflowSerie.map((p) => ({
          fecha: new Date(p.fecha).toLocaleDateString(undefined, { month: 'short', day: '2-digit' }),
          entradas: p.entradas,
          salidas: p.salidas,
          saldo: p.saldoAcumulado,
        })),
      [cashflowSerie]
    );

    const chartIngresosBrutos = useMemo(
      () =>
        ingresosBrutosProductos.map((p, idx) => ({
          name: p.productoNombre,
          value: p.ingresosBrutos,
          unidades: p.unidadesVendidas,
          color: PIE_COLORS[idx % PIE_COLORS.length],
        })),
      [ingresosBrutosProductos]
    );

  const totalGananciaNeta = useMemo(
    () => serieNeta.reduce((acc, r) => acc + r.gananciaNeta, 0),
    [serieNeta]
  );

    const totalCostosPeriodo = useMemo(
      () => costosProductos.reduce((acc, r) => acc + r.totalCostos, 0),
      [costosProductos]
    );

    const totalDeudaClientes = useMemo(
      () => deudasClientesResumen.reduce((acc, r) => acc + r.deudaTotal, 0),
      [deudasClientesResumen]
    );

    const totalDeudaProveedores = useMemo(
      () => deudasProveedoresResumen.reduce((acc, r) => acc + r.deudaTotal, 0),
      [deudasProveedoresResumen]
    );

    const totalPresupuestoMes = useMemo(
      () => presupuestoVsRealRows.reduce((acc, r) => acc + r.presupuesto, 0),
      [presupuestoVsRealRows]
    );

    const totalRealMes = useMemo(
      () => presupuestoVsRealRows.reduce((acc, r) => acc + r.real, 0),
      [presupuestoVsRealRows]
    );

  const topProducto = useMemo(() => productosRentables[0] ?? null, [productosRentables]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Finanzas</h2>
          {range && (
            <p className="text-xs text-slate-500 mt-1">
              Período: {range.desde} a {range.hasta}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="text-sm rounded-md border border-slate-300 bg-white dark:bg-slate-900 px-2 py-1"
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodKey)}
          >
            <option value="24h">Últimas 24h</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="custom">Personalizado</option>
          </select>
          {period === 'custom' && (
            <>
              <input
                type="date"
                className="text-sm rounded-md border border-slate-300 bg-white dark:bg-slate-900 px-2 py-1"
                value={customDesde}
                onChange={(e) => setCustomDesde(e.target.value)}
              />
              <input
                type="date"
                className="text-sm rounded-md border border-slate-300 bg-white dark:bg-slate-900 px-2 py-1"
                value={customHasta}
                onChange={(e) => setCustomHasta(e.target.value)}
              />
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}
      {feedback && (
        <div className="rounded-md border border-sky-200 bg-sky-50 text-sky-700 px-3 py-2 text-sm">
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4">
          <div className="text-xs text-slate-500 mb-1">Ganancia neta del período</div>
          <div className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
            ${totalGananciaNeta.toFixed(0)}
          </div>
        </div>
        <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4">
          <div className="text-xs text-slate-500 mb-1">Costos de productos (total)</div>
          <div className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
            ${totalCostosPeriodo.toFixed(0)}
          </div>
        </div>
        <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4">
          <div className="text-xs text-slate-500 mb-1">Ingresos brutos (periodo)</div>
          <div className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
            ${totalIngresosBrutos.toFixed(0)}
          </div>
        </div>
        <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4">
          <div className="text-xs text-slate-500 mb-1">Producto mas rentable</div>
          {topProducto ? (
            <div>
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {topProducto.productoNombre}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Ganancia bruta: ${topProducto.gananciaBruta.toFixed(0)}{' '}
                {topProducto.margenPorcentaje != null && `(${topProducto.margenPorcentaje.toFixed(1)}%)`}
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500">Sin datos en el período</div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-700">
        {[
          { key: 'bruta', label: 'Ingresos brutos' },
          { key: 'neta', label: 'Ganancia neta' },
          { key: 'producto', label: 'Ganancia por producto' },
          { key: 'costos', label: 'Costos de productos' },
          { key: 'categorias', label: 'Por categoría' },
            { key: 'clientes', label: 'Por cliente' },
          { key: 'cobranzas', label: 'Ctas. por cobrar' },
          { key: 'pagos', label: 'Ctas. por pagar' },
          { key: 'cashflow', label: 'Flujo de caja' },
            { key: 'presupuestos', label: 'Presupuestos' },
          { key: 'simulador', label: 'Simulador' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${
              tab === (t.key as TabKey)
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setTab(t.key as TabKey)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'neta' && (
        <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4">
          <div className="text-sm text-slate-500 mb-2">Ganancias brutas vs. netas</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartGananciaNeta}>
                <XAxis dataKey="fecha" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="ventas"
                  stroke="#4f46e5"
                  fill="#6366f1"
                  fillOpacity={0.25}
                  name="Ventas"
                />
                <Area
                  type="monotone"
                  dataKey="neta"
                  stroke="#06b6d4"
                  fill="#22d3ee"
                  fillOpacity={0.25}
                  name="Ganancia neta"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === 'bruta' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4">
            <div className="text-sm text-slate-500 mb-2">Ingresos por ventas</div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartGananciaBruta}>
                  <XAxis dataKey="fecha" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="ventas"
                    stroke="#4f46e5"
                    fill="#6366f1"
                    fillOpacity={0.25}
                    name="Ventas"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4">
            <div className="text-sm text-slate-500 mb-2">Ingresos brutos por producto</div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartIngresosBrutos}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={120}
                    innerRadius={56}
                    paddingAngle={2}
                  >
                    {chartIngresosBrutos.map((entry, idx) => (
                      <Cell key={`${entry.name}-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) =>
                      Number(value || 0).toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })
                    }
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
      {tab === 'costos' && (
        <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4">
          <div className="text-sm text-slate-500 mb-2">Costos de productos por artículo</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2 px-2">Código</th>
                  <th className="py-2 px-2">Producto</th>
                  <th className="py-2 px-2 text-right">Cantidad</th>
                  <th className="py-2 px-2 text-right">Costo total</th>
                  <th className="py-2 px-2">Moneda</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-200">
                {costosProductos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-500">
                      Sin movimientos de compras en el período.
                    </td>
                  </tr>
                )}
                {costosProductos.map((r) => (
                  <tr key={r.productoId} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-2 px-2">{r.productoCodigo}</td>
                    <td className="py-2 px-2">{r.productoNombre}</td>
                    <td className="py-2 px-2 text-right">{r.cantidad}</td>
                    <td className="py-2 px-2 text-right">
                      {r.totalCostos.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 px-2">{r.moneda}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'categorias' && (
        <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4">
          <div className="text-sm text-slate-500 mb-2">Rentabilidad por categoría</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2 px-2">Categoría</th>
                  <th className="py-2 px-2 text-right">Unidades</th>
                  <th className="py-2 px-2 text-right">Ingresos</th>
                  <th className="py-2 px-2 text-right">Costo</th>
                  <th className="py-2 px-2 text-right">Ganancia</th>
                  <th className="py-2 px-2 text-right">Margen %</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-200">
                {rentabilidadCategorias.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-500">
                      Sin ventas en el período.
                    </td>
                  </tr>
                )}
                {rentabilidadCategorias.map((c) => (
                  <tr key={c.categoriaId ?? c.categoriaNombre} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-2 px-2">{c.categoriaNombre}</td>
                    <td className="py-2 px-2 text-right">{c.unidadesVendidas}</td>
                    <td className="py-2 px-2 text-right">
                      {c.ingresos.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {c.costoTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {c.gananciaBruta.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {c.margenPorcentaje != null ? `${c.margenPorcentaje.toFixed(1)}%` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'clientes' && (
          <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4">
          <div className="text-sm text-slate-500 mb-2">Rentabilidad por cliente (ventas y deuda)</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2 px-2">Cliente</th>
                  <th className="py-2 px-2 text-right">Unidades</th>
                  <th className="py-2 px-2 text-right">Ingresos</th>
                  <th className="py-2 px-2 text-right">Costo</th>
                  <th className="py-2 px-2 text-right">Ganancia</th>
                  <th className="py-2 px-2 text-right">Margen %</th>
                  <th className="py-2 px-2 text-right">Deuda</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-200">
                {rentabilidadClientes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-slate-500">
                      Sin ventas en el período.
                    </td>
                  </tr>
                )}
                {rentabilidadClientes.map((c) => (
                  <tr key={c.clienteId} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-2 px-2">
                      {c.clienteNombre}
                      {c.clienteApellido ? ` ${c.clienteApellido}` : ''}
                    </td>
                    <td className="py-2 px-2 text-right">{c.unidadesVendidas}</td>
                    <td className="py-2 px-2 text-right">
                      {c.ingresos.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {c.costoTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {c.gananciaBruta.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {c.margenPorcentaje != null ? `${c.margenPorcentaje.toFixed(1)}%` : '-'}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {c.deuda.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>
        )}

      {tab === 'cobranzas' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4">
            <div className="text-sm text-slate-500 mb-2">Cuentas por cobrar</div>
            <div className="text-xs text-slate-500 mb-2">
              Deuda total clientes: {totalDeudaClientes.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="py-2 px-2">Cliente</th>
                    <th className="py-2 px-2 text-right">Total</th>
                    <th className="py-2 px-2 text-right">+90 dias</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700 dark:text-slate-200">
                  {deudasClientesResumen.map((c) => (
                    <tr
                      key={c.clienteId}
                      className={`border-t border-slate-100 dark:border-slate-800 cursor-pointer ${
                        clienteDeudaSeleccionado === c.clienteId ? 'bg-indigo-50 dark:bg-indigo-950/30' : ''
                      }`}
                      onClick={() => setClienteDeudaSeleccionado(c.clienteId)}
                    >
                      <td className="py-2 px-2">{c.clienteNombre} {c.clienteApellido || ''}</td>
                      <td className="py-2 px-2 text-right">{c.deudaTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className="py-2 px-2 text-right">{c.deudaMas90.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4">
            <div className="text-sm text-slate-500 mb-2">Detalle ventas pendientes</div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="py-2 px-2">Venta</th>
                    <th className="py-2 px-2">Fecha</th>
                    <th className="py-2 px-2 text-right">Neto</th>
                    <th className="py-2 px-2 text-right">Pagado</th>
                    <th className="py-2 px-2 text-right">Saldo</th>
                    <th className="py-2 px-2 text-right">Dias</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700 dark:text-slate-200">
                  {ventasPendientesCliente.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-slate-500">Selecciona un cliente.</td>
                    </tr>
                  )}
                  {ventasPendientesCliente.map((v) => (
                    <tr key={v.ventaId} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="py-2 px-2">#{v.ventaId}</td>
                      <td className="py-2 px-2">{v.fecha}</td>
                      <td className="py-2 px-2 text-right">{v.neto.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className="py-2 px-2 text-right">{v.totalPagado.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className="py-2 px-2 text-right">{v.saldo.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className="py-2 px-2 text-right">{v.dias}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'pagos' && (
        <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4">
          <div className="text-sm text-slate-500 mb-2">Cuentas por pagar</div>
          <div className="text-xs text-slate-500 mb-2">
            Deuda total proveedores: {totalDeudaProveedores.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            {diasPromedioPagoProveedores != null && (
              <span> | Dias promedio: {diasPromedioPagoProveedores.toFixed(1)}</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2 px-2">Proveedor</th>
                  <th className="py-2 px-2 text-right">Total</th>
                  <th className="py-2 px-2 text-right">0-30</th>
                  <th className="py-2 px-2 text-right">31-60</th>
                  <th className="py-2 px-2 text-right">61-90</th>
                  <th className="py-2 px-2 text-right">+90</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-200">
                {deudasProveedoresResumen.map((p) => (
                  <tr key={p.proveedorId} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-2 px-2">{p.proveedorNombre}</td>
                    <td className="py-2 px-2 text-right">{p.deudaTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td className="py-2 px-2 text-right">{p.deuda0_30.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td className="py-2 px-2 text-right">{p.deuda31_60.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td className="py-2 px-2 text-right">{p.deuda61_90.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td className="py-2 px-2 text-right">{p.deudaMas90.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
        {tab === 'cashflow' && (
          <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4 space-y-4">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <div className="text-sm text-slate-500 mb-1">Flujo de caja diario</div>
                <div className="text-xs text-slate-500">
                  Saldo inicial:{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {saldoInicial.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                  {' · '}Saldo mГ­nimo:{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {saldoMinimo.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                  {' · '}Saldo mГЎximo:{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {saldoMaximo.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  DГ­as por debajo del umbral ({umbralMinimo.toLocaleString(undefined, { maximumFractionDigits: 0 })}):{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {diasPorDebajoUmbral}
                  </span>
                </div>
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartCashflow}>
                  <XAxis dataKey="fecha" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="entradas"
                    stroke="#22c55e"
                    fill="#22c55e"
                    fillOpacity={0.25}
                    name="Entradas"
                  />
                  <Area
                    type="monotone"
                    dataKey="salidas"
                    stroke="#ef4444"
                    fill="#ef4444"
                    fillOpacity={0.18}
                    name="Salidas"
                  />
                  <Area
                    type="monotone"
                    dataKey="saldo"
                    stroke="#0ea5e9"
                    fill="#0ea5e9"
                    fillOpacity={0.12}
                    name="Saldo acumulado"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {tab === 'presupuestos' && (
          <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4 space-y-4">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <div className="text-sm text-slate-500 mb-1">Presupuesto vs real por categoria</div>
                <div className="text-xs text-slate-500">
                  Total presupuesto:{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {totalPresupuestoMes.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                  {' | '}Total real:{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {totalRealMes.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Anio</label>
                  <input
                    type="number"
                    className="input-modern text-xs md:text-sm w-24"
                    value={presupuestoAnio}
                    onChange={(e) => setPresupuestoAnio(Number(e.target.value) || presupuestoAnio)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Mes</label>
                  <select
                    className="input-modern text-xs md:text-sm w-28"
                    value={presupuestoMes}
                    onChange={(e) => setPresupuestoMes(Number(e.target.value) || presupuestoMes)}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {m.toString().padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <form
              className="grid grid-cols-1 md:grid-cols-5 gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                guardarPresupuesto();
              }}
            >
              <select
                className="input-modern text-xs md:text-sm"
                value={presupuestoForm.tipo}
                onChange={(e) => setPresupuestoForm((prev) => ({ ...prev, tipo: e.target.value }))}
              >
                <option value="ventas">ventas</option>
                <option value="gastos">gastos</option>
              </select>
              <input
                className="input-modern text-xs md:text-sm md:col-span-2"
                placeholder="Categoria"
                value={presupuestoForm.categoria}
                onChange={(e) =>
                  setPresupuestoForm((prev) => ({ ...prev, categoria: e.target.value }))
                }
              />
              <input
                type="number"
                className="input-modern text-xs md:text-sm"
                placeholder="Monto"
                value={presupuestoForm.monto}
                onChange={(e) => setPresupuestoForm((prev) => ({ ...prev, monto: e.target.value }))}
              />
              <button
                type="submit"
                disabled={savingPresupuesto}
                className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm disabled:opacity-50"
              >
                {savingPresupuesto ? 'Guardando...' : 'Guardar'}
              </button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={presupuestoVsRealRows.map((r) => ({
                      label: `${r.tipo} - ${r.categoria}`,
                      presupuesto: r.presupuesto,
                      real: r.real,
                    }))}
                    margin={{ left: 0, right: 0 }}
                  >
                    <XAxis dataKey="label" hide />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="presupuesto" fill="#6366f1" name="Presupuesto" />
                    <Bar dataKey="real" fill="#f59e0b" name="Real" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-xs md:text-sm">
                  <thead className="text-left text-slate-500">
                    <tr>
                      <th className="py-2 px-2">Tipo</th>
                      <th className="py-2 px-2">Categoria</th>
                      <th className="py-2 px-2 text-right">Monto</th>
                      <th className="py-2 px-2 text-right">Accion</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 dark:text-slate-200">
                    {presupuestosMes.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-slate-500">
                          Sin presupuestos para el mes seleccionado.
                        </td>
                      </tr>
                    )}
                    {presupuestosMes.map((p) => (
                      <tr key={p.id || `${p.tipo}-${p.categoria}`} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="py-2 px-2">{p.tipo}</td>
                        <td className="py-2 px-2">{p.categoria}</td>
                        <td className="py-2 px-2 text-right">
                          {p.monto.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <button
                            type="button"
                            className="px-2 py-1 rounded-md bg-rose-600 text-white"
                            onClick={() => eliminarPresupuestoRow(p.id)}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'simulador' && (
          <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input
                type="number"
                className="input-modern text-xs md:text-sm"
                value={simuladorForm.periodoDias}
                onChange={(e) => setSimuladorForm((prev) => ({ ...prev, periodoDias: Number(e.target.value) || 30 }))}
                placeholder="Periodo dias"
              />
              <input
                type="number"
                className="input-modern text-xs md:text-sm"
                value={simuladorForm.aumentoPrecios}
                onChange={(e) => setSimuladorForm((prev) => ({ ...prev, aumentoPrecios: Number(e.target.value) || 0 }))}
                placeholder="Aumento precios %"
              />
              <input
                type="number"
                className="input-modern text-xs md:text-sm"
                value={simuladorForm.aumentoCostos}
                onChange={(e) => setSimuladorForm((prev) => ({ ...prev, aumentoCostos: Number(e.target.value) || 0 }))}
                placeholder="Aumento costos %"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  className="input-modern text-xs md:text-sm flex-1"
                  value={simuladorForm.aumentoGastos}
                  onChange={(e) => setSimuladorForm((prev) => ({ ...prev, aumentoGastos: Number(e.target.value) || 0 }))}
                  placeholder="Aumento gastos %"
                />
                <button
                  type="button"
                  onClick={ejecutarSimulador}
                  disabled={simuladorLoading}
                  className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm disabled:opacity-50"
                >
                  {simuladorLoading ? 'Calculando...' : 'Simular'}
                </button>
              </div>
            </div>

            {simuladorResultado && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3">
                  <div className="text-xs text-slate-500">Actual</div>
                  <div>Ganancia neta: {simuladorResultado.actual.gananciaNeta.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
                <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3">
                  <div className="text-xs text-slate-500">Simulado</div>
                  <div>Ganancia neta: {simuladorResultado.simulado.gananciaNeta.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
              </div>
            )}
          </div>
        )}
        {tab === 'producto' && (
        <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4">
          <div className="text-sm text-slate-500 mb-2">Top productos por ganancia bruta</div>
          <div className="h-72 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={productosRentables.map((p) => ({
                  nombre: p.productoNombre,
                  ganancia: p.gananciaBruta,
                }))}
                margin={{ left: 0, right: 0 }}
              >
                <XAxis dataKey="nombre" hide />
                <YAxis />
                <Tooltip />
                <Bar dataKey="ganancia" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2 px-2">Código</th>
                  <th className="py-2 px-2">Producto</th>
                  <th className="py-2 px-2 text-right">Unidades</th>
                  <th className="py-2 px-2 text-right">Ingresos</th>
                  <th className="py-2 px-2 text-right">Costo</th>
                  <th className="py-2 px-2 text-right">Ganancia</th>
                  <th className="py-2 px-2 text-right">Margen %</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-200">
                {productosRentables.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-slate-500">
                      Sin ventas en el período.
                    </td>
                  </tr>
                )}
                {productosRentables.map((p) => (
                  <tr key={p.productoId} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-2 px-2">{p.productoCodigo}</td>
                    <td className="py-2 px-2">{p.productoNombre}</td>
                    <td className="py-2 px-2 text-right">{p.unidadesVendidas}</td>
                    <td className="py-2 px-2 text-right">
                      {p.ingresos.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {p.costoTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {p.gananciaBruta.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {p.margenPorcentaje != null ? `${p.margenPorcentaje.toFixed(1)}%` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-xs text-slate-500">
          Cargando datos financieros...
        </div>
      )}
    </div>
  );
}



