const { check, validationResult } = require('express-validator');
const configRepo = require('../db/repositories/configRepository');
const categoryRepo = require('../db/repositories/categoryRepository');
const productRepo = require('../db/repositories/productRepository');

const CONFIG_KEYS = {
  name: 'catalogo_nombre',
  logoUrl: 'catalogo_logo_url',
  destacadoId: 'catalogo_destacado_producto_id',
  publicado: 'catalogo_publicado',
};

async function getCatalogConfig(req, res) {
  try {
    const [name, logoUrl, destacadoId, publicado] = await Promise.all([
      configRepo.getTextParam(CONFIG_KEYS.name),
      configRepo.getTextParam(CONFIG_KEYS.logoUrl),
      configRepo.getNumericParam(CONFIG_KEYS.destacadoId),
      configRepo.getNumericParam(CONFIG_KEYS.publicado),
    ]);

    res.json({
      nombre: name || '',
      logo_url: logoUrl || '',
      destacado_producto_id: destacadoId != null ? Number(destacadoId) : null,
      publicado: publicado != null ? Number(publicado) === 1 : true,
    });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener la configuracion del catalogo' });
  }
}

const validateConfig = [
  check('nombre').optional().isString().isLength({ max: 120 }),
  check('logo_url').optional().isString().isLength({ max: 500 }),
  check('destacado_producto_id').optional().isInt({ gt: 0 }),
  check('publicado').optional().isBoolean(),
];

async function updateCatalogConfig(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { nombre, logo_url, destacado_producto_id, publicado } = req.body || {};
  const usuarioId =
    req.user?.sub && Number.isFinite(Number(req.user.sub)) ? Number(req.user.sub) : null;

  try {
    if (typeof nombre !== 'undefined') {
      await configRepo.setTextParam(CONFIG_KEYS.name, String(nombre || ''), usuarioId);
    }
    if (typeof logo_url !== 'undefined') {
      await configRepo.setTextParam(CONFIG_KEYS.logoUrl, String(logo_url || ''), usuarioId);
    }
    if (typeof destacado_producto_id !== 'undefined') {
      if (destacado_producto_id === null || destacado_producto_id === '') {
        await configRepo.setNumericParam(CONFIG_KEYS.destacadoId, null, usuarioId);
      } else {
        const prodId = Number(destacado_producto_id);
        if (!Number.isInteger(prodId) || prodId <= 0) {
          return res.status(400).json({ error: 'ID de producto destacado invalido' });
        }
        const product = await productRepo.findById(prodId);
        if (!product) return res.status(404).json({ error: 'Producto destacado no encontrado' });
        await configRepo.setNumericParam(CONFIG_KEYS.destacadoId, prodId, usuarioId);
      }
    }
    if (typeof publicado !== 'undefined') {
      await configRepo.setNumericParam(CONFIG_KEYS.publicado, publicado ? 1 : 0, usuarioId);
    }
    return getCatalogConfig(req, res);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo actualizar la configuracion del catalogo' });
  }
}

async function getCatalogPublic(req, res) {
  try {
    const [config, categorias, productos] = await Promise.all([
      configRepo.getTextParam(CONFIG_KEYS.name),
      categoryRepo.getAllActive(),
      productRepo.listCatalog(),
    ]);
    const [logoUrl, destacadoId] = await Promise.all([
      configRepo.getTextParam(CONFIG_KEYS.logoUrl),
      configRepo.getNumericParam(CONFIG_KEYS.destacadoId),
    ]);

    let destacado = null;
    if (destacadoId) {
      destacado = await productRepo.findById(Number(destacadoId));
    }

    res.json({
      config: {
        nombre: config || '',
        logo_url: logoUrl || '',
        destacado_producto_id: destacadoId != null ? Number(destacadoId) : null,
      },
      destacado,
      categorias,
      productos,
    });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener el catalogo' });
  }
}

module.exports = {
  getCatalogConfig,
  updateCatalogConfig: [...validateConfig, updateCatalogConfig],
  getCatalogPublic,
};
