const { query } = require('../db/pg');
const PDFDocument = require('pdfkit');

async function deudas(req, res) {
  try {
    const { cliente_id } = req.query || {};
    if (cliente_id) {
      const { rows } = await query('SELECT * FROM vista_deudas WHERE cliente_id = $1', [cliente_id]);
      return res.json(rows);
    }
    const { rows } = await query('SELECT * FROM vista_deudas');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener deudas' });
  }
}

async function gananciasMensuales(req, res) {
  try {
    const { rows } = await query('SELECT mes, total_ventas::float AS total_ventas, total_gastos::float AS total_gastos, ganancia_neta::float AS ganancia_neta FROM vista_ganancias_mensuales ORDER BY mes');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener ganancias mensuales' });
  }
}

async function stockBajo(req, res) {
  try {
    const { rows } = await query('SELECT * FROM vista_stock_bajo ORDER BY producto_id');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener stock bajo' });
  }
}

async function topClientes(req, res) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 200);
    const { rows } = await query('SELECT * FROM vista_top_clientes ORDER BY total_comprado DESC LIMIT $1', [limit]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener top clientes' });
  }
}

module.exports = { deudas, gananciasMensuales, stockBajo, topClientes };

// PDF Remito de entrega por venta
async function remitoPdf(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const header = await query(
      `SELECT v.id, v.fecha, v.total::float AS total, v.descuento::float AS descuento, v.impuestos::float AS impuestos,
              v.neto::float AS neto, v.estado_pago, v.estado_entrega,
              c.nombre AS cliente_nombre, COALESCE(c.apellido,'') AS cliente_apellido
         FROM ventas v
         JOIN clientes c ON c.id = v.cliente_id
        WHERE v.id = $1
        LIMIT 1`,
      [id]
    );
    if (!header.rows.length) return res.status(404).json({ error: 'Venta no encontrada' });
    const h = header.rows[0];

    const detalle = await query(
      `SELECT d.cantidad, d.precio_unitario::float AS precio_unitario, p.nombre AS producto_nombre
         FROM ventas_detalle d
         JOIN productos p ON p.id = d.producto_id
        WHERE d.venta_id = $1
        ORDER BY d.id ASC`,
      [id]
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="remito-${id}.pdf"`);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    // Cabecera
    const company = process.env.COMPANY_NAME || 'Sistemas de Gestión';
    const companyExtra = process.env.COMPANY_ADDRESS || '';
    doc.fontSize(18).text(company, { align: 'left' });
    if (companyExtra) doc.fontSize(10).fillColor('#555').text(companyExtra);
    doc.moveDown(0.5);
    doc.fillColor('#000').fontSize(16).text('Remito de entrega', { align: 'right' });
    doc.moveTo(doc.page.margins.left, doc.y + 5).lineTo(doc.page.width - doc.page.margins.right, doc.y + 5).strokeColor('#999').stroke();
    doc.moveDown(1);

    // Datos
    const fecha = new Date(h.fecha);
    const f = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')} ${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
    const cliente = `${h.cliente_nombre}${h.cliente_apellido ? ' ' + h.cliente_apellido : ''}`;

    doc.fontSize(11);
    doc.text(`Remito N°: ${h.id}`);
    doc.text(`Fecha: ${f}`);
    doc.text(`Cliente: ${cliente}`);
    doc.text(`Estado de entrega: ${h.estado_entrega || 'pendiente'}`);
    doc.moveDown(0.5);

    // Tabla de ítems
    const startY = doc.y + 10;
    const colX = [doc.page.margins.left, 120, 360, 450];
    doc.fontSize(11).fillColor('#333');
    doc.text('Cantidad', colX[0], startY);
    doc.text('Descripción', colX[1], startY);
    doc.text('P. Unit.', colX[2], startY, { width: 80, align: 'right' });
    doc.text('Subtotal', colX[3], startY, { width: 100, align: 'right' });
    doc.moveTo(colX[0], startY + 15).lineTo(doc.page.width - doc.page.margins.right, startY + 15).strokeColor('#999').stroke();

    let y = startY + 20;
    doc.fillColor('#000');
    let calcSubtotal = 0;
    for (const it of detalle.rows) {
      const cantidad = Number(it.cantidad) || 0;
      const unit = Number(it.precio_unitario) || 0;
      const sub = cantidad * unit;
      calcSubtotal += sub;
      doc.text(String(cantidad), colX[0], y);
      doc.text(String(it.producto_nombre || ''), colX[1], y, { width: 230 });
      doc.text(`$ ${unit.toFixed(2)}`, colX[2], y, { width: 80, align: 'right' });
      doc.text(`$ ${sub.toFixed(2)}`, colX[3], y, { width: 100, align: 'right' });
      y += 18;
      if (y > doc.page.height - doc.page.margins.bottom - 80) {
        doc.addPage();
        y = doc.y;
      }
    }

    // Totales
    doc.moveDown(1);
    const totalY = y + 10;
    doc.moveTo(colX[2], totalY).lineTo(doc.page.width - doc.page.margins.right, totalY).strokeColor('#999').stroke();
    const lineH = 16;
    doc.fontSize(11);
    doc.text('Subtotal:', colX[2], totalY + 6, { width: 80, align: 'right' });
    doc.text(`$ ${calcSubtotal.toFixed(2)}`, colX[3], totalY + 6, { width: 100, align: 'right' });
    doc.text('Descuento:', colX[2], totalY + 6 + lineH, { width: 80, align: 'right' });
    doc.text(`$ ${(h.descuento || 0).toFixed(2)}`, colX[3], totalY + 6 + lineH, { width: 100, align: 'right' });
    doc.text('Impuestos:', colX[2], totalY + 6 + lineH * 2, { width: 80, align: 'right' });
    doc.text(`$ ${(h.impuestos || 0).toFixed(2)}`, colX[3], totalY + 6 + lineH * 2, { width: 100, align: 'right' });
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text('Total:', colX[2], totalY + 6 + lineH * 3, { width: 80, align: 'right' });
    doc.text(`$ ${(h.neto || h.total || 0).toFixed(2)}`, colX[3], totalY + 6 + lineH * 3, { width: 100, align: 'right' });
    doc.font('Helvetica');

    doc.moveDown(2);
    doc.fontSize(9).fillColor('#666').text('Se realizó la compra de las cantidades y productos indicados arriba, por el total detallado.', { align: 'left' });

    doc.end();
  } catch (e) {
    console.error('[reportes] remitoPdf error', e);
    res.status(500).json({ error: 'No se pudo generar el PDF' });
  }
}

module.exports.remitoPdf = remitoPdf;
