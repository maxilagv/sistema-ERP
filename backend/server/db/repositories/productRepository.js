const { query, withTransaction } = require('../../db/pg');

async function listProducts({ q, categoryId, limit = 50, offset = 0, sort = 'id', dir = 'desc' } = {}) {
  const params = [];
  const where = ['p.activo = TRUE', 'c.activo = TRUE'];
  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    where.push(`(LOWER(p.nombre) LIKE $${params.length} OR LOWER(p.descripcion) LIKE $${params.length} OR LOWER(p.codigo) LIKE $${params.length})`);
  }
  if (categoryId) {
    params.push(Number(categoryId));
    where.push(`p.categoria_id = $${params.length}`);
  }

  const sortMap = {
    id: 'p.id',
    name: 'p.nombre',
    price: 'p.precio_venta',
    created_at: 'p.creado_en',
    updated_at: 'p.actualizado_en',
    stock: 'COALESCE(i.cantidad_disponible, 0)'
  };
  const sortCol = sortMap[sort] || sortMap.id;
  const sortDir = String(dir || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const off = Math.max(parseInt(offset, 10) || 0, 0);
  params.push(lim); // $n
  params.push(off); // $n+1

  const sql = `
    SELECT p.id,
           p.categoria_id AS category_id,
           p.nombre AS name,
           p.descripcion AS description,
           p.precio_venta::float AS price,
           p.precio_costo_pesos::float AS costo_pesos,
           p.precio_costo_dolares::float AS costo_dolares,
           p.tipo_cambio::float AS tipo_cambio,
           p.margen_local::float AS margen_local,
           p.margen_distribuidor::float AS margen_distribuidor,
           p.precio_local::float AS price_local,
           p.precio_distribuidor::float AS price_distribuidor,
           c.nombre AS category_name,
           COALESCE(i.cantidad_disponible, 0) AS stock_quantity,
           p.creado_en AS created_at,
           p.actualizado_en AS updated_at,
           CASE WHEN p.activo THEN NULL ELSE p.actualizado_en END AS deleted_at,
           img.image_url
      FROM productos p
      JOIN categorias c ON c.id = p.categoria_id
 LEFT JOIN inventario i ON i.producto_id = p.id
 LEFT JOIN LATERAL (
        SELECT url AS image_url
          FROM producto_imagenes
         WHERE producto_id = p.id
         ORDER BY orden ASC, id ASC
         LIMIT 1
      ) img ON TRUE
     WHERE ${where.join(' AND ')}
  ORDER BY ${sortCol} ${sortDir}
     LIMIT $${params.length - 1}
    OFFSET $${params.length}`;

  const { rows } = await query(sql, params);
  return rows;
}

async function ensureInventory(client, productoId) {
  const r = await client.query('SELECT id FROM inventario WHERE producto_id = $1', [productoId]);
  if (!r.rowCount) {
    await client.query(
      'INSERT INTO inventario(producto_id, cantidad_disponible, cantidad_reservada) VALUES ($1, 0, 0)',
      [productoId]
    );
  }
}

function genSkuCandidate() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand = (n) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  return `SKU-${rand(3)}${Date.now().toString(36).toUpperCase().slice(-3)}`;
}

async function createProduct({
  name,
  description,
  price,
  image_url,
  category_id,
  stock_quantity,
  precio_costo_pesos,
  precio_costo_dolares,
  tipo_cambio,
  margen_local,
  margen_distribuidor,
  proveedor_id,
}) {
  const initialStock = Number.isFinite(Number(stock_quantity)) && Number(stock_quantity) >= 0 ? Number(stock_quantity) : 0;

  const costoPesos =
    typeof precio_costo_pesos !== 'undefined'
      ? Number(precio_costo_pesos) || 0
      : 0;
  const costoDolares =
    typeof precio_costo_dolares !== 'undefined'
      ? Number(precio_costo_dolares) || 0
      : 0;
  const fx = typeof tipo_cambio !== 'undefined' && tipo_cambio !== null ? Number(tipo_cambio) || null : null;

  let costoPesosFinal = costoPesos;
  let costoDolaresFinal = costoDolares;

  if (!costoPesosFinal && costoDolaresFinal && fx) {
    costoPesosFinal = costoDolaresFinal * fx;
  } else if (!costoDolaresFinal && costoPesosFinal && fx && fx !== 0) {
    costoDolaresFinal = costoPesosFinal / fx;
  }

  const margenLocal = typeof margen_local !== 'undefined' ? Number(margen_local) : 0.15;
  const margenDistribuidor = typeof margen_distribuidor !== 'undefined' ? Number(margen_distribuidor) : 0.45;

  const basePrecioVenta = Number(price);
  const precioLocal =
    costoPesosFinal > 0
      ? costoPesosFinal * (1 + margenLocal)
      : basePrecioVenta || 0;
  const precioDistribuidor =
    costoPesosFinal > 0
      ? costoPesosFinal * (1 + margenDistribuidor)
      : basePrecioVenta || 0;

  return withTransaction(async (client) => {
    const cat = await client.query('SELECT id FROM categorias WHERE id = $1 AND activo = TRUE', [category_id]);
    if (!cat.rowCount) {
      const e = new Error('Category not found');
      e.status = 400;
      throw e;
    }

    // Ensure unique codigo
    let codigo = genSkuCandidate();
    let tries = 0;
    while (tries < 6) {
      const exists = await client.query('SELECT 1 FROM productos WHERE codigo = $1 LIMIT 1', [codigo]);
      if (!exists.rowCount) break;
      codigo = genSkuCandidate();
      tries++;
    }

    const ins = await client.query(
      `INSERT INTO productos(
         categoria_id,
         codigo,
         nombre,
         descripcion,
         precio_costo,
         precio_venta,
         precio_costo_pesos,
         precio_costo_dolares,
         tipo_cambio,
         margen_local,
         margen_distribuidor,
         precio_local,
         precio_distribuidor,
         proveedor_id,
         activo
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, TRUE)
       RETURNING id`,
      [
        category_id,
        codigo,
        name,
        description || null,
        costoPesosFinal || 0,
        precioLocal,
        costoPesosFinal || 0,
        costoDolaresFinal || 0,
        fx,
        margenLocal,
        margenDistribuidor,
        precioLocal,
        precioDistribuidor,
        proveedor_id || null,
      ]
    );
    const productoId = ins.rows[0].id;

    await ensureInventory(client, productoId);
    if (initialStock > 0) {
      await client.query('UPDATE inventario SET cantidad_disponible = $1 WHERE producto_id = $2', [initialStock, productoId]);
    }
    if (image_url) {
      await client.query(
        `INSERT INTO producto_imagenes(producto_id, url, orden)
         VALUES ($1, $2, 0)
         ON CONFLICT (producto_id, orden) DO UPDATE SET url = EXCLUDED.url`,
        [productoId, image_url]
      );
    }
    return { id: productoId };
  });
}

async function updateProduct(
  id,
  {
    name,
    description,
    price,
    image_url,
    category_id,
    stock_quantity,
    precio_costo_pesos,
    precio_costo_dolares,
    tipo_cambio,
    margen_local,
    margen_distribuidor,
    proveedor_id,
  }
) {
  return withTransaction(async (client) => {
    if (typeof category_id !== 'undefined') {
      const cat = await client.query('SELECT id FROM categorias WHERE id = $1 AND activo = TRUE', [category_id]);
      if (!cat.rowCount) {
        const e = new Error('Category not found');
        e.status = 400;
        throw e;
      }
    }

    const { rows: currentRows } = await client.query(
      'SELECT precio_costo_pesos, precio_costo_dolares, tipo_cambio, margen_local, margen_distribuidor FROM productos WHERE id = $1',
      [id]
    );
    if (!currentRows.length) {
      const e = new Error('Product not found');
      e.status = 404;
      throw e;
    }

    const current = currentRows[0];

    let costoPesosFinal =
      typeof precio_costo_pesos !== 'undefined'
        ? Number(precio_costo_pesos) || 0
        : Number(current.precio_costo_pesos) || 0;
    let costoDolaresFinal =
      typeof precio_costo_dolares !== 'undefined'
        ? Number(precio_costo_dolares) || 0
        : Number(current.precio_costo_dolares) || 0;

    let fx =
      typeof tipo_cambio !== 'undefined'
        ? (tipo_cambio === null ? null : Number(tipo_cambio) || null)
        : current.tipo_cambio;

    if (!costoPesosFinal && costoDolaresFinal && fx) {
      costoPesosFinal = costoDolaresFinal * fx;
    } else if (!costoDolaresFinal && costoPesosFinal && fx && fx !== 0) {
      costoDolaresFinal = costoPesosFinal / fx;
    }

    const margenLocal =
      typeof margen_local !== 'undefined'
        ? Number(margen_local)
        : Number(current.margen_local) || 0.15;
    const margenDistribuidor =
      typeof margen_distribuidor !== 'undefined'
        ? Number(margen_distribuidor)
        : Number(current.margen_distribuidor) || 0.45;

    const sets = [];
    const params = [];
    let p = 1;

    if (typeof category_id !== 'undefined') { sets.push(`categoria_id = $${p++}`); params.push(Number(category_id)); }
    if (typeof name !== 'undefined') { sets.push(`nombre = $${p++}`); params.push(name); }
    if (typeof description !== 'undefined') { sets.push(`descripcion = $${p++}`); params.push(description || null); }

    if (typeof precio_costo_pesos !== 'undefined' || typeof precio_costo_dolares !== 'undefined' || typeof tipo_cambio !== 'undefined') {
      sets.push(`precio_costo = $${p++}`);
      params.push(costoPesosFinal || 0);
      sets.push(`precio_costo_pesos = $${p++}`);
      params.push(costoPesosFinal || 0);
      sets.push(`precio_costo_dolares = $${p++}`);
      params.push(costoDolaresFinal || 0);
      sets.push(`tipo_cambio = $${p++}`);
      params.push(fx);
    }

    if (typeof margen_local !== 'undefined') {
      sets.push(`margen_local = $${p++}`);
      params.push(margenLocal);
    }
    if (typeof margen_distribuidor !== 'undefined') {
      sets.push(`margen_distribuidor = $${p++}`);
      params.push(margenDistribuidor);
    }

    let precioVentaFinal;
    let precioLocalFinal;
    let precioDistribuidorFinal;

    if (typeof price !== 'undefined') {
      precioVentaFinal = Number(price);
    }

    if (costoPesosFinal > 0) {
      precioLocalFinal = costoPesosFinal * (1 + margenLocal);
      precioDistribuidorFinal = costoPesosFinal * (1 + margenDistribuidor);
    } else if (typeof price !== 'undefined') {
      precioLocalFinal = precioVentaFinal;
      precioDistribuidorFinal = precioVentaFinal;
    }

    if (typeof price !== 'undefined') {
      sets.push(`precio_venta = $${p++}`);
      params.push(precioVentaFinal);
    }
    if (typeof precioLocalFinal !== 'undefined') {
      sets.push(`precio_local = $${p++}`);
      params.push(precioLocalFinal);
    }
    if (typeof precioDistribuidorFinal !== 'undefined') {
      sets.push(`precio_distribuidor = $${p++}`);
      params.push(precioDistribuidorFinal);
    }

    if (typeof proveedor_id !== 'undefined') {
      sets.push(`proveedor_id = $${p++}`);
      params.push(proveedor_id || null);
    }

    if (sets.length) {
      params.push(id);
      await client.query(`UPDATE productos SET ${sets.join(', ')}, actualizado_en = CURRENT_TIMESTAMP WHERE id = $${p}`, params);
    }

    if (typeof stock_quantity !== 'undefined') {
      await ensureInventory(client, id);
      await client.query('UPDATE inventario SET cantidad_disponible = $1 WHERE producto_id = $2', [Math.max(0, Number(stock_quantity) || 0), id]);
    }
    if (typeof image_url !== 'undefined') {
      if (image_url) {
        await client.query(
          `INSERT INTO producto_imagenes(producto_id, url, orden)
           VALUES ($1, $2, 0)
           ON CONFLICT (producto_id, orden) DO UPDATE SET url = EXCLUDED.url`,
          [id, image_url]
        );
      } else {
        await client.query('DELETE FROM producto_imagenes WHERE producto_id = $1 AND orden = 0', [id]);
      }
    }
  });
}

async function deactivateProduct(id) {
  await query('UPDATE productos SET activo = FALSE, actualizado_en = CURRENT_TIMESTAMP WHERE id = $1', [id]);
}

async function getProductHistory(productId, { limit = 50, offset = 0 } = {}) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const off = Math.max(parseInt(offset, 10) || 0, 0);
  const { rows } = await query(
    `SELECT ph.id,
            ph.producto_id,
            ph.proveedor_id,
            prov.nombre AS proveedor_nombre,
            ph.fecha,
            ph.costo_pesos::float AS costo_pesos,
            ph.costo_dolares::float AS costo_dolares,
            ph.tipo_cambio::float AS tipo_cambio,
            ph.margen_local::float AS margen_local,
            ph.margen_distribuidor::float AS margen_distribuidor,
            ph.precio_local::float AS precio_local,
            ph.precio_distribuidor::float AS precio_distribuidor,
            ph.usuario_id,
            u.nombre AS usuario_nombre
       FROM productos_historial ph
  LEFT JOIN proveedores prov ON prov.id = ph.proveedor_id
  LEFT JOIN usuarios u ON u.id = ph.usuario_id
      WHERE ph.producto_id = $1
      ORDER BY ph.fecha DESC, ph.id DESC
      LIMIT $2 OFFSET $3`,
    [productId, lim, off]
  );
  return rows;
}

module.exports = {
  listProducts,
  createProduct,
  updateProduct,
  deactivateProduct,
  getProductHistory,
};
