const { query } = require('../db/pg');

// Helpers de fechas: rango [desde, hasta] en formato YYYY-MM-DD
function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function getDateRange(req) {
  const { desde, hasta, periodo } = req.query || {};
  const now = new Date();

  let from;
  let to;

  if (desde || hasta) {
    from = parseDate(desde) || new Date(now);
    to = parseDate(hasta) || new Date(now);
  } else {
    const p = (periodo || '30d').toString().toLowerCase();
    to = new Date(now);
    from = new Date(now);

    if (p === '24h') {
      from.setDate(from.getDate() - 1);
    } else if (p === '7d' || p === '1w' || p === 'semana') {
      from.setDate(from.getDate() - 6);
    } else {
      // Default: últimos 30 días (hoy incluido)
      from.setDate(from.getDate() - 29);
    }
  }

  // Normalizar a solo fecha (UTC) para SQL
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  return { desde: fromStr, hasta: toStr };
}

// 1) Costos de productos (vinculado a compras)
async function costosProductos(req, res) {
  try {
    const { desde, hasta } = getDateRange(req);
    const { groupBy, producto_id, proveedor_id, categoria_id } = req.query || {};

    const gb = (groupBy || 'dia').toString().toLowerCase();
    const allowedGroupBy = new Set(['dia', 'producto', 'proveedor', 'categoria']);
    const group = allowedGroupBy.has(gb) ? gb : 'dia';

    const params = [desde, hasta];
    const where = ['fecha >= $1::date', 'fecha < $2::date + INTERVAL \'1 day\''];

    if (producto_id) {
      params.push(Number(producto_id));
      where.push(`producto_id = $${params.length}`);
    }
    if (proveedor_id) {
      params.push(Number(proveedor_id));
      where.push(`proveedor_id = $${params.length}`);
    }
    if (categoria_id) {
      params.push(Number(categoria_id));
      where.push(`categoria_id = $${params.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Totales por moneda
    const { rows: totRows } = await query(
      `
      SELECT
        COALESCE(moneda, 'N/A') AS moneda,
        COALESCE(SUM(subtotal), 0)::float AS total_costos,
        COALESCE(SUM(cantidad), 0)::float AS total_cantidad
      FROM vista_costos_productos
      ${whereClause}
      GROUP BY COALESCE(moneda, 'N/A')
      ORDER BY moneda
    `,
      params
    );

    let detallesSql;
    if (group === 'producto') {
      detallesSql = `
        SELECT
          producto_id,
          producto_codigo,
          producto_nombre,
          COALESCE(moneda, 'N/A') AS moneda,
          COALESCE(SUM(cantidad), 0)::float AS cantidad,
          COALESCE(SUM(subtotal), 0)::float AS total_costos
        FROM vista_costos_productos
        ${whereClause}
        GROUP BY producto_id, producto_codigo, producto_nombre, COALESCE(moneda, 'N/A')
        ORDER BY total_costos DESC, producto_nombre ASC
      `;
    } else if (group === 'proveedor') {
      detallesSql = `
        SELECT
          proveedor_id,
          proveedor_nombre,
          COALESCE(moneda, 'N/A') AS moneda,
          COALESCE(SUM(cantidad), 0)::float AS cantidad,
          COALESCE(SUM(subtotal), 0)::float AS total_costos
        FROM vista_costos_productos
        ${whereClause}
        GROUP BY proveedor_id, proveedor_nombre, COALESCE(moneda, 'N/A')
        ORDER BY total_costos DESC, proveedor_nombre ASC
      `;
    } else if (group === 'categoria') {
      detallesSql = `
        SELECT
          categoria_id,
          categoria_nombre,
          COALESCE(moneda, 'N/A') AS moneda,
          COALESCE(SUM(cantidad), 0)::float AS cantidad,
          COALESCE(SUM(subtotal), 0)::float AS total_costos
        FROM vista_costos_productos
        ${whereClause}
        GROUP BY categoria_id, categoria_nombre, COALESCE(moneda, 'N/A')
        ORDER BY total_costos DESC, categoria_nombre ASC
      `;
    } else {
      // group === 'dia'
      detallesSql = `
        SELECT
          fecha::date AS fecha,
          COALESCE(moneda, 'N/A') AS moneda,
          COALESCE(SUM(cantidad), 0)::float AS cantidad,
          COALESCE(SUM(subtotal), 0)::float AS total_costos
        FROM vista_costos_productos
        ${whereClause}
        GROUP BY fecha::date, COALESCE(moneda, 'N/A')
        ORDER BY fecha::date ASC, moneda ASC
      `;
    }

    const { rows: detRows } = await query(detallesSql, params);

    const totalesPorMoneda = totRows.map((r) => ({
      moneda: r.moneda,
      totalCostos: Number(r.total_costos || 0),
      totalCantidad: Number(r.total_cantidad || 0),
    }));

    let detalles;
    if (group === 'producto') {
      detalles = detRows.map((r) => ({
        productoId: r.producto_id,
        productoCodigo: r.producto_codigo,
        productoNombre: r.producto_nombre,
        moneda: r.moneda,
        cantidad: Number(r.cantidad || 0),
        totalCostos: Number(r.total_costos || 0),
      }));
    } else if (group === 'proveedor') {
      detalles = detRows.map((r) => ({
        proveedorId: r.proveedor_id,
        proveedorNombre: r.proveedor_nombre,
        moneda: r.moneda,
        cantidad: Number(r.cantidad || 0),
        totalCostos: Number(r.total_costos || 0),
      }));
    } else if (group === 'categoria') {
      detalles = detRows.map((r) => ({
        categoriaId: r.categoria_id,
        categoriaNombre: r.categoria_nombre,
        moneda: r.moneda,
        cantidad: Number(r.cantidad || 0),
        totalCostos: Number(r.total_costos || 0),
      }));
    } else {
      detalles = detRows.map((r) => ({
        fecha: r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : r.fecha,
        moneda: r.moneda,
        cantidad: Number(r.cantidad || 0),
        totalCostos: Number(r.total_costos || 0),
      }));
    }

    res.json({
      desde,
      hasta,
      groupBy: group,
      totalesPorMoneda,
      detalles,
    });
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron obtener los costos de productos' });
  }
}

// 2) Ganancia bruta (ingresos por ventas)
async function gananciaBruta(req, res) {
  try {
    const { desde, hasta } = getDateRange(req);
    const { agregado, detalle, limit } = req.query || {};

    const agg = (agregado || 'dia').toString().toLowerCase();
    const det = (detalle || '').toString().toLowerCase();
    const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);

    const params = [desde, hasta];

    const { rows: totRows } = await query(
      `
      SELECT
        COALESCE(SUM(neto), 0)::float       AS total_ventas,
        COALESCE(SUM(descuento), 0)::float  AS total_descuentos,
        COALESCE(SUM(impuestos), 0)::float  AS total_impuestos
      FROM ventas
      WHERE estado_pago <> 'cancelado'
        AND fecha >= $1::date
        AND fecha < $2::date + INTERVAL '1 day'
    `,
      params
    );

    const totals = totRows[0] || {
      total_ventas: 0,
      total_descuentos: 0,
      total_impuestos: 0,
    };

    let serieSql;
    if (agg === 'mes') {
      serieSql = `
        SELECT
          date_trunc('month', fecha)::date AS periodo,
          COALESCE(SUM(neto), 0)::float    AS total_ventas
        FROM ventas
        WHERE estado_pago <> 'cancelado'
          AND fecha >= $1::date
          AND fecha < $2::date + INTERVAL '1 day'
        GROUP BY date_trunc('month', fecha)::date
        ORDER BY date_trunc('month', fecha)::date
      `;
    } else {
      serieSql = `
        SELECT
          fecha::date                      AS periodo,
          COALESCE(SUM(neto), 0)::float    AS total_ventas
        FROM ventas
        WHERE estado_pago <> 'cancelado'
          AND fecha >= $1::date
          AND fecha < $2::date + INTERVAL '1 day'
        GROUP BY fecha::date
        ORDER BY fecha::date
      `;
    }

    const { rows: serieRows } = await query(serieSql, params);

    const serie = serieRows.map((r) => ({
      fecha: r.periodo instanceof Date ? r.periodo.toISOString().slice(0, 10) : r.periodo,
      totalVentas: Number(r.total_ventas || 0),
    }));

    let porProducto = [];
    let porCliente = [];

    if (det === 'producto') {
      const { rows } = await query(
        `
        SELECT
          vd.producto_id,
          p.codigo  AS producto_codigo,
          p.nombre  AS producto_nombre,
          COALESCE(SUM(vd.cantidad), 0)::float   AS unidades_vendidas,
          COALESCE(SUM(vd.subtotal), 0)::float   AS total_ventas
        FROM ventas_detalle vd
        JOIN ventas v   ON v.id = vd.venta_id
        JOIN productos p ON p.id = vd.producto_id
        WHERE v.estado_pago <> 'cancelado'
          AND v.fecha >= $1::date
          AND v.fecha < $2::date + INTERVAL '1 day'
        GROUP BY vd.producto_id, p.codigo, p.nombre
        ORDER BY total_ventas DESC, producto_nombre ASC
        LIMIT $3
      `,
        [...params, lim]
      );
      porProducto = rows.map((r) => ({
        productoId: r.producto_id,
        productoCodigo: r.producto_codigo,
        productoNombre: r.producto_nombre,
        unidadesVendidas: Number(r.unidades_vendidas || 0),
        totalVentas: Number(r.total_ventas || 0),
      }));
    } else if (det === 'cliente') {
      const { rows } = await query(
        `
        SELECT
          v.cliente_id,
          c.nombre                        AS cliente_nombre,
          COALESCE(c.apellido, '')        AS cliente_apellido,
          COUNT(DISTINCT v.id)            AS cantidad_ventas,
          COALESCE(SUM(v.neto), 0)::float AS total_ventas
        FROM ventas v
        JOIN clientes c ON c.id = v.cliente_id
        WHERE v.estado_pago <> 'cancelado'
          AND v.fecha >= $1::date
          AND v.fecha < $2::date + INTERVAL '1 day'
        GROUP BY v.cliente_id, c.nombre, c.apellido
        ORDER BY total_ventas DESC, cliente_nombre ASC
        LIMIT $3
      `,
        [...params, lim]
      );
      porCliente = rows.map((r) => ({
        clienteId: r.cliente_id,
        clienteNombre: r.cliente_nombre,
        clienteApellido: r.cliente_apellido,
        cantidadVentas: Number(r.cantidad_ventas || 0),
        totalVentas: Number(r.total_ventas || 0),
      }));
    }

    res.json({
      desde,
      hasta,
      agregado: agg === 'mes' ? 'mes' : 'dia',
      totalVentas: Number(totals.total_ventas || 0),
      totalDescuentos: Number(totals.total_descuentos || 0),
      totalImpuestos: Number(totals.total_impuestos || 0),
      serie,
      porProducto,
      porCliente,
    });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener la ganancia bruta' });
  }
}

// 3) Ganancia neta (ventas - costo productos vendidos - gastos - inversiones)
async function gananciaNeta(req, res) {
  try {
    const { desde, hasta } = getDateRange(req);
    const params = [desde, hasta];

    // Serie diaria combinando ventas, costo de productos, gastos e inversiones
    const { rows } = await query(
      `
      WITH rango AS (
        SELECT generate_series($1::date, $2::date, '1 day')::date AS fecha
      ),
      ventas_d AS (
        SELECT
          fecha::date                      AS fecha,
          COALESCE(SUM(neto), 0)::float    AS total_ventas
        FROM ventas
        WHERE estado_pago <> 'cancelado'
          AND fecha >= $1::date
          AND fecha < $2::date + INTERVAL '1 day'
        GROUP BY fecha::date
      ),
      cogs_d AS (
        SELECT
          v.fecha::date AS fecha,
          COALESCE(SUM(vd.cantidad * p.precio_costo), 0)::float AS total_costo_productos
        FROM ventas v
        JOIN ventas_detalle vd ON vd.venta_id = v.id
        JOIN productos p       ON p.id = vd.producto_id
        WHERE v.estado_pago <> 'cancelado'
          AND v.fecha >= $1::date
          AND v.fecha < $2::date + INTERVAL '1 day'
        GROUP BY v.fecha::date
      ),
      gastos_d AS (
        SELECT
          fecha::date                      AS fecha,
          COALESCE(SUM(monto), 0)::float   AS total_gastos
        FROM gastos
        WHERE fecha >= $1::date
          AND fecha < $2::date + INTERVAL '1 day'
        GROUP BY fecha::date
      ),
      inv_d AS (
        SELECT
          fecha::date                      AS fecha,
          COALESCE(SUM(monto), 0)::float   AS total_inversiones
        FROM inversiones
        WHERE fecha >= $1::date
          AND fecha < $2::date + INTERVAL '1 day'
        GROUP BY fecha::date
      )
      SELECT
        r.fecha,
        COALESCE(v.total_ventas, 0)        AS total_ventas,
        COALESCE(c.total_costo_productos, 0) AS total_costo_productos,
        COALESCE(g.total_gastos, 0)        AS total_gastos,
        COALESCE(i.total_inversiones, 0)   AS total_inversiones
      FROM rango r
      LEFT JOIN ventas_d v ON v.fecha = r.fecha
      LEFT JOIN cogs_d   c ON c.fecha = r.fecha
      LEFT JOIN gastos_d g ON g.fecha = r.fecha
      LEFT JOIN inv_d    i ON i.fecha = r.fecha
      ORDER BY r.fecha
    `,
      params
    );

    let totalVentas = 0;
    let totalCostoProductos = 0;
    let totalGastos = 0;
    let totalInversiones = 0;

    const serie = rows.map((r) => {
      const tv = Number(r.total_ventas || 0);
      const tc = Number(r.total_costo_productos || 0);
      const tg = Number(r.total_gastos || 0);
      const ti = Number(r.total_inversiones || 0);

      totalVentas += tv;
      totalCostoProductos += tc;
      totalGastos += tg;
      totalInversiones += ti;

      const gananciaBrutaDia = tv - tc;
      const gananciaNetaDia = gananciaBrutaDia - tg - ti;

      return {
        fecha: r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : r.fecha,
        totalVentas: tv,
        totalCostoProductos: tc,
        totalGastos: tg,
        totalInversiones: ti,
        gananciaBruta: gananciaBrutaDia,
        gananciaNeta: gananciaNetaDia,
      };
    });

    const gananciaBruta = totalVentas - totalCostoProductos;
    const gananciaNetaTotal = gananciaBruta - totalGastos - totalInversiones;

    res.json({
      desde,
      hasta,
      totalVentas,
      totalCostoProductos,
      totalGastos,
      totalInversiones,
      gananciaBruta,
      gananciaNeta: gananciaNetaTotal,
      serie,
    });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener la ganancia neta' });
  }
}

// 4) Ganancia por producto (top productos por rentabilidad)
async function gananciaPorProducto(req, res) {
  try {
    const { desde, hasta } = getDateRange(req);
    const { limit, orderBy, categoria_id } = req.query || {};

    const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
    const order = (orderBy || 'ganancia').toString().toLowerCase();
    const allowedOrder = new Set(['ganancia', 'ingresos', 'cantidad', 'margen']);

    const orderKey = allowedOrder.has(order) ? order : 'ganancia';

    const params = [desde, hasta];
    const where = [
      'v.estado_pago <> \'cancelado\'',
      'v.fecha >= $1::date',
      'v.fecha < $2::date + INTERVAL \'1 day\'',
    ];

    if (categoria_id) {
      params.push(Number(categoria_id));
      where.push(`p.categoria_id = $${params.length}`);
    }

    let orderClause = 'ganancia_bruta DESC';
    if (orderKey === 'ingresos') {
      orderClause = 'ingresos DESC';
    } else if (orderKey === 'cantidad') {
      orderClause = 'unidades_vendidas DESC';
    } else if (orderKey === 'margen') {
      orderClause = 'margen_porcentaje DESC NULLS LAST';
    }

    const sql = `
      SELECT
        p.id                            AS producto_id,
        p.codigo                        AS producto_codigo,
        p.nombre                        AS producto_nombre,
        COALESCE(SUM(vd.cantidad), 0)::float                   AS unidades_vendidas,
        COALESCE(SUM(vd.subtotal), 0)::float                   AS ingresos,
        COALESCE(SUM(vd.cantidad * p.precio_costo), 0)::float  AS costo_total,
        COALESCE(SUM(vd.subtotal - vd.cantidad * p.precio_costo), 0)::float AS ganancia_bruta,
        CASE
          WHEN SUM(vd.cantidad * p.precio_costo) > 0
            THEN (SUM(vd.subtotal - vd.cantidad * p.precio_costo) / SUM(vd.cantidad * p.precio_costo)) * 100
          ELSE NULL
        END AS margen_porcentaje
      FROM productos p
      JOIN ventas_detalle vd ON vd.producto_id = p.id
      JOIN ventas v          ON v.id = vd.venta_id
      WHERE ${where.join(' AND ')}
      GROUP BY p.id, p.codigo, p.nombre
      ORDER BY ${orderClause}
      LIMIT $${params.length + 1}
    `;

    const { rows } = await query(sql, [...params, lim]);

    const items = rows.map((r) => ({
      productoId: r.producto_id,
      productoCodigo: r.producto_codigo,
      productoNombre: r.producto_nombre,
      unidadesVendidas: Number(r.unidades_vendidas || 0),
      ingresos: Number(r.ingresos || 0),
      costoTotal: Number(r.costo_total || 0),
      gananciaBruta: Number(r.ganancia_bruta || 0),
      margenPorcentaje: r.margen_porcentaje != null ? Number(r.margen_porcentaje) : null,
    }));

    res.json({
      desde,
      hasta,
      orderBy: orderKey,
      limit: lim,
      items,
    });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener la ganancia por producto' });
  }
}

module.exports = {
  costosProductos,
  gananciaBruta,
  gananciaNeta,
  gananciaPorProducto,
};

