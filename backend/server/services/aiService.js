const { query } = require('../db/pg');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const LOCAL_AI_URL = process.env.LOCAL_AI_URL;
const AI_PY_FORECAST = process.env.AI_PY_FORECAST === 'true';
const AI_PY_PRICING = process.env.AI_PY_PRICING === 'true';
const AI_PY_TIMEOUT_MS = Number(process.env.AI_PY_TIMEOUT_MS || 5000);

function toNumber(x, d = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : d;
}

function withTimeout(promise, ms = AI_PY_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('AI Python timeout')), ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function httpRequest(rawUrl, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(rawUrl);
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;

      const options = {
        method,
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        headers,
      };

      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode || 0,
            ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
            text: data,
          });
        });
      });

      req.on('error', (err) => reject(err));

      if (body) req.write(body);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

async function getProductsBasic(categoryId) {
  const params = [];
  const where = [];
  if (categoryId != null) {
    params.push(Number(categoryId));
    where.push(`categoria_id = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT id, nombre, precio_costo::float AS precio_costo, precio_venta::float AS precio_venta, activo
       FROM productos
       ${whereSql}`,
    params
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

async function getDailySalesSeriesByProduct(historyDays = 90) {
  const { rows } = await query(
    `SELECT vd.producto_id AS id,
            date_trunc('day', v.fecha)::date AS dia,
            SUM(vd.cantidad)::float AS unidades
       FROM ventas_detalle vd
       JOIN ventas v ON v.id = vd.venta_id
      WHERE v.estado_pago <> 'cancelado'
        AND v.fecha >= NOW() - ($1 || ' days')::interval
      GROUP BY vd.producto_id, date_trunc('day', v.fecha)
      ORDER BY vd.producto_id, date_trunc('day', v.fecha)`,
    [String(historyDays)]
  );
  const map = new Map();
  for (const r of rows) {
    const id = Number(r.id);
    const arr = map.get(id) || [];
    arr.push({ dia: r.dia, unidades: toNumber(r.unidades, 0) });
    map.set(id, arr);
  }
  return map;
}

async function callPythonForecast({ products, historyDays, forecastDays }) {
  if (!LOCAL_AI_URL) throw new Error('LOCAL_AI_URL not configured');

  const salesSeriesMap = await getDailySalesSeriesByProduct(historyDays);

  const series = products
    .filter((p) => p.activo !== false)
    .map((p) => ({
      producto_id: p.id,
      producto_nombre: p.nombre,
      history: (salesSeriesMap.get(p.id) || []).map((h) => ({
        fecha: h.dia,
        unidades: h.unidades,
      })),
    }));

  const payload = JSON.stringify({
    history_days: Math.max(1, Number(historyDays)),
    horizon_days: Number(forecastDays),
    series,
  });

  const url = `${LOCAL_AI_URL.replace(/\/$/, '')}/forecast`;

  const res = await withTimeout(
    httpRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      body: payload,
    })
  );

  if (!res.ok) {
    throw new Error(`AI Python forecast error: ${res.status} ${res.text || ''}`.trim());
  }

  const data = JSON.parse(res.text || '{}');
  if (!data || !Array.isArray(data.forecasts)) {
    throw new Error('AI Python forecast: invalid response');
  }
  return data.forecasts;
}

async function forecastByProductSimple({ forecastDays = 14, historyDays = 90, limit = 100, stockTargetDays, categoryId }) {
  const [products, invMap, salesMap] = await Promise.all([
    getProductsBasic(categoryId),
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
      const sugeridoReponer = Math.max(0, forecastUnits - available);
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

async function forecastByProduct({ forecastDays = 14, historyDays = 90, limit = 100, stockTargetDays, categoryId }) {
  if (!AI_PY_FORECAST || !LOCAL_AI_URL) {
    return forecastByProductSimple({ forecastDays, historyDays, limit, stockTargetDays, categoryId });
  }

  try {
    const [products, invMap] = await Promise.all([
      getProductsBasic(categoryId),
      getInventoryMap(),
    ]);

    const forecasts = await callPythonForecast({ products, historyDays, forecastDays });
    const byId = new Map();
    for (const f of forecasts) {
      if (f && typeof f.producto_id !== 'undefined') {
        byId.set(Number(f.producto_id), f);
      }
    }

    const list = products
      .filter((p) => p.activo !== false)
      .map((p) => {
        const f = byId.get(p.id);
        const dailyAvgRaw = f && typeof f.daily_avg === 'number' ? f.daily_avg : 0;
        const dailyAvg = toNumber(dailyAvgRaw, 0);
        const available = toNumber(invMap.get(p.id), 0);
        const forecastUnits = dailyAvg * Number(forecastDays);
        const coberturaDias = dailyAvg > 0 ? available / dailyAvg : Infinity;
        const sugeridoReponer = Math.max(0, forecastUnits - available);
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
  } catch (err) {
    console.error('AI Python forecast failed, falling back to simple forecast:', err);
    return forecastByProductSimple({ forecastDays, historyDays, limit, stockTargetDays, categoryId });
  }
}

async function stockouts({ days = 14, historyDays = 90, limit = 100, categoryId }) {
  const forecast = await forecastByProduct({ forecastDays: days, historyDays, limit: 5000, categoryId });
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

async function forecastDetail({ productoId, historyDays = 90, forecastDays = 14 }) {
  const id = Number(productoId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error('Producto inválido');
  }
  const { rows: prodRows } = await query(
    `SELECT id, nombre FROM productos WHERE id = $1`,
    [id]
  );
  if (!prodRows.length) {
    throw new Error('Producto no encontrado');
  }
  const producto = prodRows[0];

  const { rows } = await query(
    `SELECT date_trunc('day', v.fecha) AS dia, SUM(vd.cantidad)::float AS unidades
       FROM ventas_detalle vd
       JOIN ventas v ON v.id = vd.venta_id
      WHERE vd.producto_id = $1
        AND v.estado_pago <> 'cancelado'
        AND v.fecha >= NOW() - ($2 || ' days')::interval
      GROUP BY 1
      ORDER BY 1`,
    [id, String(historyDays)]
  );

  const history = rows.map((r) => ({
    dia: r.dia,
    unidades: toNumber(r.unidades, 0),
  }));

  const daysBase = Math.max(1, Number(historyDays));
  const totalQty = history.reduce((acc, r) => acc + r.unidades, 0);
  const dailyAvg = totalQty / daysBase;

  const lastDate = history.length ? new Date(history[history.length - 1].dia) : new Date();
  const forecast = [];
  for (let i = 1; i <= Number(forecastDays); i += 1) {
    const d = new Date(lastDate);
    d.setDate(d.getDate() + i);
    forecast.push({
      dia: d,
      unidades: dailyAvg,
    });
  }

  return {
    producto_id: producto.id,
    producto_nombre: producto.nombre,
    daily_avg: Number(dailyAvg.toFixed(4)),
    history,
    forecast,
  };
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

  const buildSimpleRecs = () => {
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
  };

  if (!AI_PY_PRICING || !LOCAL_AI_URL) {
    return buildSimpleRecs();
  }

  try {
    const productosPayload = products
      .filter((p) => p.activo !== false)
      .map((p) => {
        const dailyAvg = toNumber(salesMap.get(p.id), 0) / daysBase;
        return {
          producto_id: p.id,
          producto_nombre: p.nombre,
          precio_costo: Math.max(0, toNumber(p.precio_costo, 0)),
          precio_actual: Math.max(0, toNumber(p.precio_venta, 0)),
          rotacion_diaria: Number(dailyAvg.toFixed(4)),
        };
      });

    const payload = JSON.stringify({
      history_days: daysBase,
      target_margin: targetMargin,
      productos: productosPayload,
    });

    const url = `${LOCAL_AI_URL.replace(/\/$/, '')}/pricing`;

    const res = await withTimeout(
      httpRequest(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        body: payload,
      })
    );

    if (!res.ok) {
      throw new Error(`AI Python pricing error: ${res.status} ${res.text || ''}`.trim());
    }

    const data = JSON.parse(res.text || '{}');
    if (!data || !Array.isArray(data.recomendaciones)) {
      throw new Error('AI Python pricing: invalid response');
    }

    const recs = data.recomendaciones
      .map((r) => ({
        producto_id: r.producto_id,
        producto_nombre: r.producto_nombre,
        precio_actual:
          productosPayload.find((p) => p.producto_id === r.producto_id)?.precio_actual ?? 0,
        precio_sugerido: toNumber(r.precio_sugerido, 0),
        diferencia: toNumber(r.diferencia, 0),
        margen_estimado:
          typeof r.margen_estimado === 'number' ? r.margen_estimado : null,
        rotacion_diaria:
          typeof r.rotacion_diaria === 'number'
            ? r.rotacion_diaria
            : productosPayload.find((p) => p.producto_id === r.producto_id)?.rotacion_diaria ?? 0,
      }))
      .sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia))
      .slice(0, Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500));

    return recs;
  } catch (err) {
    console.error('AI Python pricing failed, falling back to simple pricing:', err);
    return buildSimpleRecs();
  }
}

module.exports = {
  forecastByProduct,
  stockouts,
  anomalies,
  pricingRecommendations,
  forecastDetail,
};
