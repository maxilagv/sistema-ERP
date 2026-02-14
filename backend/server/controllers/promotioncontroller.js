const { query } = require('../db/pg');

function normalizePromoRow(r) {
  return {
    id: Number(r.id),
    titulo: r.titulo,
    descripcion: r.descripcion || '',
    descuento_porcentaje:
      r.descuento_porcentaje != null ? Number(r.descuento_porcentaje) : null,
    codigo: r.codigo || null,
    segmento: r.segmento || null,
    fecha_inicio: r.fecha_inicio,
    fecha_fin: r.fecha_fin,
    activo: Boolean(r.activo),
    creado_en: r.creado_en,
    actualizado_en: r.actualizado_en,
  };
}

async function list(req, res) {
  try {
    const includeInactive = String(req.query?.inactivos || '').trim() === '1';
    const params = [];
    const where = [];

    if (!includeInactive) {
      where.push('p.activo = TRUE');
    }

    const { rows } = await query(
      `SELECT p.id,
              p.titulo,
              p.descripcion,
              p.descuento_porcentaje::float AS descuento_porcentaje,
              p.codigo,
              p.segmento,
              p.fecha_inicio::date AS fecha_inicio,
              p.fecha_fin::date AS fecha_fin,
              p.activo,
              p.creado_en,
              p.actualizado_en
         FROM promociones p
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY p.activo DESC, p.id DESC`,
      params
    );

    res.json(rows.map(normalizePromoRow));
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron obtener las promociones' });
  }
}

async function create(req, res) {
  try {
    const body = req.body || {};
    const titulo = String(body.titulo || '').trim();
    if (!titulo) return res.status(400).json({ error: 'Titulo requerido' });

    const descuento =
      body.descuento_porcentaje != null && body.descuento_porcentaje !== ''
        ? Number(body.descuento_porcentaje)
        : null;

    if (descuento != null && (!Number.isFinite(descuento) || descuento < 0 || descuento > 100)) {
      return res.status(400).json({ error: 'descuento_porcentaje invalido' });
    }

    const userId = Number(req.user?.sub) || null;

    const { rows } = await query(
      `INSERT INTO promociones(
         titulo,
         descripcion,
         descuento_porcentaje,
         codigo,
         segmento,
         fecha_inicio,
         fecha_fin,
         activo,
         creado_por_usuario_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id,
                 titulo,
                 descripcion,
                 descuento_porcentaje::float AS descuento_porcentaje,
                 codigo,
                 segmento,
                 fecha_inicio::date AS fecha_inicio,
                 fecha_fin::date AS fecha_fin,
                 activo,
                 creado_en,
                 actualizado_en`,
      [
        titulo,
        body.descripcion || null,
        descuento,
        body.codigo || null,
        body.segmento || null,
        body.fecha_inicio || null,
        body.fecha_fin || null,
        body.activo !== false,
        userId,
      ]
    );

    res.status(201).json(normalizePromoRow(rows[0]));
  } catch (e) {
    res.status(500).json({ error: 'No se pudo crear la promocion' });
  }
}

async function update(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID invalido' });
  }

  try {
    const body = req.body || {};
    const sets = [];
    const params = [];
    let p = 1;

    const fields = {
      titulo: 'titulo',
      descripcion: 'descripcion',
      codigo: 'codigo',
      segmento: 'segmento',
      fecha_inicio: 'fecha_inicio',
      fecha_fin: 'fecha_fin',
      activo: 'activo',
    };

    for (const [k, col] of Object.entries(fields)) {
      if (!Object.prototype.hasOwnProperty.call(body, k)) continue;
      sets.push(`${col} = $${p++}`);
      params.push(body[k] ?? null);
    }

    if (Object.prototype.hasOwnProperty.call(body, 'descuento_porcentaje')) {
      const descuento =
        body.descuento_porcentaje != null && body.descuento_porcentaje !== ''
          ? Number(body.descuento_porcentaje)
          : null;
      if (descuento != null && (!Number.isFinite(descuento) || descuento < 0 || descuento > 100)) {
        return res.status(400).json({ error: 'descuento_porcentaje invalido' });
      }
      sets.push(`descuento_porcentaje = $${p++}`);
      params.push(descuento);
    }

    if (!sets.length) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    params.push(id);
    const { rows } = await query(
      `UPDATE promociones
          SET ${sets.join(', ')}, actualizado_en = NOW()
        WHERE id = $${p}
        RETURNING id,
                  titulo,
                  descripcion,
                  descuento_porcentaje::float AS descuento_porcentaje,
                  codigo,
                  segmento,
                  fecha_inicio::date AS fecha_inicio,
                  fecha_fin::date AS fecha_fin,
                  activo,
                  creado_en,
                  actualizado_en`,
      params
    );

    if (!rows.length) return res.status(404).json({ error: 'Promocion no encontrada' });
    res.json(normalizePromoRow(rows[0]));
  } catch (e) {
    res.status(500).json({ error: 'No se pudo actualizar la promocion' });
  }
}

async function remove(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID invalido' });
  }

  try {
    const { rows } = await query(
      `DELETE FROM promociones WHERE id = $1 RETURNING id`,
      [id]
    );

    if (!rows.length) return res.status(404).json({ error: 'Promocion no encontrada' });
    res.json({ id, deleted: true });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo eliminar la promocion' });
  }
}

module.exports = {
  list,
  create,
  update,
  remove,
};
