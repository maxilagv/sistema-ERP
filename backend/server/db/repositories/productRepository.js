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

async function createProduct({ name, description, price, image_url, category_id, stock_quantity }) {
  const initialStock = Number.isFinite(Number(stock_quantity)) && Number(stock_quantity) >= 0 ? Number(stock_quantity) : 0;
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
      `INSERT INTO productos(categoria_id, codigo, nombre, descripcion, precio_venta, activo)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING id`,
      [category_id, codigo, name, description || null, Number(price)]
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

async function updateProduct(id, { name, description, price, image_url, category_id, stock_quantity }) {
  return withTransaction(async (client) => {
    const cat = await client.query('SELECT id FROM categorias WHERE id = $1 AND activo = TRUE', [category_id]);
    if (!cat.rowCount) {
      const e = new Error('Category not found');
      e.status = 400;
      throw e;
    }

    const sets = [];
    const params = [];
    let p = 1;
    if (typeof category_id !== 'undefined') { sets.push(`categoria_id = $${p++}`); params.push(Number(category_id)); }
    if (typeof name !== 'undefined') { sets.push(`nombre = $${p++}`); params.push(name); }
    if (typeof description !== 'undefined') { sets.push(`descripcion = $${p++}`); params.push(description || null); }
    if (typeof price !== 'undefined') { sets.push(`precio_venta = $${p++}`); params.push(Number(price)); }
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

module.exports = {
  listProducts,
  createProduct,
  updateProduct,
  deactivateProduct,
};
