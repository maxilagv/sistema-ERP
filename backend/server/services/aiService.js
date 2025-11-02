const { query } = require('../db/pg');

function toNumber(x, d = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : d;
}

async function getProductsBasic() {
  const { rows } = await query(
    `SELECT id, nombre, precio_costo::float AS precio_costo, precio_venta::float AS precio_venta, activo
       FROM productos`
  );
  return rows;
}

async function getInventoryMap() {
  const { rows } = await query(
    `SELECT producto_id AS id, COALESCE(cantidad_disponible,0) AS disponible FROM inventario`
  );
  const map = new Map();
  for (const r of rows) map.set(Number(r.id), toNumber(r.disponible, 0));
  return map;
}

async function getSalesQtyByProduct(historyDays = 90) {
  const { rows } = await query(
    `SELECT vd.producto_id AS id, SUM(vd.cantidad)::float AS unidades
       FROM ventas_detalle vd
       JOIN ventas v ON v.id = vd.venta_id
      WHERE v.estado_pago <> 'cancelado' AND v.fecha >= NOW() - ($1 || ' days')::interval
      GROUP BY vd.producto_id`,
    [String(historyDays)]
  );
  const map = new Map();
  for (const r of rows) map.set(Number(r.id), toNumber(r.unidades, 0));
  return map;
}

async function forecastByProduct({ forecastDays = 14, historyDays = 90, limit = 100, stockTargetDays }) {
  const targetDays = Number(stockTargetDays || process.env.AI_STOCK_TARGET_DAYS || 30);
  const [products, invMap, salesMap] = await Promise.all([
    getProductsBasic(),
    getInventoryMap(),
    getSalesQtyByProduct(historyDays),
  ]);

  const daysBase = Math.max(1, Number(historyDays));
  const list = products
    .filter((p) => p.activo !== false)
    .map((p) => {
      const totalQty = toNumber(salesMap.get(p.id), 0);
      const dailyAvg = totalQty / daysBase;
      const available = toNumber(invMap.get(p.id), 0);
      const forecastUnits = dailyAvg * Number(forecastDays);
      const coberturaDias = dailyAvg > 0 ? available / dailyAvg : Infinity;
      const sugeridoReponer = Math.max(0, targetDays * dailyAvg - available);
      return {
        producto_id: p.id,
        producto_nombre: p.nombre,
        daily_avg: Number(dailyAvg.toFixed(4)),
        forecast_units: Number(forecastUnits.toFixed(2)),
        disponible: available,
        cobertura_dias: Number((coberturaDias === Infinity ? 9999 : coberturaDias).toFixed(2)),
        sugerido_reponer: Math.ceil(sugeridoReponer),
      };
    })
    .sort((a, b) => b.daily_avg - a.daily_avg)
    .slice(0, Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500));

  return list;
}

async function stockouts({ days = 14, historyDays = 90, limit = 100 }) {
  const forecast = await forecastByProduct({ forecastDays: days, historyDays, limit: 5000 });
  const atRisk = forecast
    .filter((r) => r.daily_avg > 0 && r.disponible / r.daily_avg < Number(days))
    .map((r) => ({
      ...r,
      dias_hasta_quiebre: Number((r.disponible / r.daily_avg).toFixed(2)),
    }))
    .sort((a, b) => a.dias_hasta_quiebre - b.dias_hasta_quiebre)
    .slice(0, Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500));
  return atRisk;
}

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const v = mean(arr.map((x) => (x - m) ** 2));
  return Math.sqrt(v);
}

async function dailyTotals({ table, valueCol, periodDays = 90, filter = '' }) {
  const { rows } = await query(
    `SELECT date_trunc('day', fecha) AS dia, SUM(${valueCol})::float AS total
       FROM ${table}
      WHERE fecha >= NOW() - ($1 || ' days')::interval ${filter}
      GROUP BY 1
      ORDER BY 1`,
    [String(periodDays)]
  );
  return rows.map((r) => ({ dia: r.dia, total: toNumber(r.total, 0) }));
}

async function anomalies({ scope = 'sales', period = 90, sigma = 3 }) {
  const k = Number(sigma || process.env.AI_ANOMALY_SIGMA || 3);
  const out = {};
  if (scope === 'sales' || scope === 'both') {
    const sales = await dailyTotals({ table: 'ventas', valueCol: 'neto', periodDays: period, filter: `AND estado_pago <> 'cancelado'` });
    const vals = sales.map((r) => r.total);
    const m = mean(vals);
    const s = stddev(vals);
    out.sales = sales
      .map((r) => ({ ...r, z: s ? (r.total - m) / s : 0 }))
      .filter((r) => Math.abs(r.z) >= k)
      .map((r) => ({ dia: r.dia, total: r.total, z: Number(r.z.toFixed(2)), tipo: r.z >= 0 ? 'alto' : 'bajo' }));
  }
  if (scope === 'expenses' || scope === 'both') {
    const gastos = await dailyTotals({ table: 'gastos', valueCol: 'monto', periodDays: period });
    const vals = gastos.map((r) => r.total);
    const m = mean(vals);
    const s = stddev(vals);
    out.expenses = gastos
      .map((r) => ({ ...r, z: s ? (r.total - m) / s : 0 }))
      .filter((r) => Math.abs(r.z) >= k)
      .map((r) => ({ dia: r.dia, total: r.total, z: Number(r.z.toFixed(2)), tipo: r.z >= 0 ? 'alto' : 'bajo' }));
  }
  return out;
}

async function pricingRecommendations({ margin, historyDays = 90, limit = 200 }) {
  const targetMargin = toNumber(margin ?? process.env.PRICING_TARGET_MARGIN, 0.3);
  const rotLow = toNumber(process.env.AI_ROTATION_LOW_PER_DAY, 0.05);
  const rotHigh = toNumber(process.env.AI_ROTATION_HIGH_PER_DAY, 0.5);
  const adjUp = toNumber(process.env.AI_PRICING_UP_ADJ, 0.05);
  const adjDown = toNumber(process.env.AI_PRICING_DOWN_ADJ, 0.05);

  const [products, salesMap] = await Promise.all([
    getProductsBasic(),
    getSalesQtyByProduct(historyDays),
  ]);

  const daysBase = Math.max(1, Number(historyDays));
  const recs = products
    .filter((p) => p.activo !== false)
    .map((p) => {
      const dailyAvg = toNumber(salesMap.get(p.id), 0) / daysBase;
      const costo = Math.max(0, toNumber(p.precio_costo, 0));
      const precioActual = Math.max(0, toNumber(p.precio_venta, 0));
      let base = Math.max(costo * (1 + targetMargin), costo);
      if (dailyAvg >= rotHigh) base *= 1 + adjUp;
      else if (dailyAvg > 0 && dailyAvg <= rotLow) base *= Math.max(0.01, 1 - adjDown);
      const sugerido = Number(base.toFixed(2));
      const dif = Number((sugerido - precioActual).toFixed(2));
      const impactoMargen = costo > 0 ? Number(((sugerido - costo) / sugerido).toFixed(3)) : null;
      return {
        producto_id: p.id,
        producto_nombre: p.nombre,
        precio_actual: precioActual,
        precio_sugerido: sugerido,
        diferencia: dif,
        margen_estimado: impactoMargen,
        rotacion_diaria: Number(dailyAvg.toFixed(4)),
      };
    })
    .sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia))
    .slice(0, Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500));

  return recs;
}

module.exports = {
  forecastByProduct,
  stockouts,
  anomalies,
  pricingRecommendations,
};

