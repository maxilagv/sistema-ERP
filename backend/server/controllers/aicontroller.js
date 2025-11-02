const ai = require('../services/aiService');

async function forecast(req, res) {
  try {
    const forecastDays = Math.max(1, Number(req.query.days || 14));
    const historyDays = Math.max(7, Number(req.query.history || 90));
    const limit = Math.max(1, Number(req.query.limit || 100));
    const stockTargetDays = req.query.stockTargetDays
      ? Number(req.query.stockTargetDays)
      : undefined;
    const data = await ai.forecastByProduct({ forecastDays, historyDays, limit, stockTargetDays });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener el pronóstico' });
  }
}

async function stockouts(req, res) {
  try {
    const days = Math.max(1, Number(req.query.days || 14));
    const historyDays = Math.max(7, Number(req.query.history || 90));
    const limit = Math.max(1, Number(req.query.limit || 100));
    const data = await ai.stockouts({ days, historyDays, limit });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener riesgo de stockout' });
  }
}

async function anomalias(req, res) {
  try {
    const scope = (req.query.scope || 'sales').toString();
    const period = Math.max(7, Number(req.query.period || 90));
    const sigma = Math.max(1, Number(req.query.sigma || 3));
    const data = await ai.anomalies({ scope, period, sigma });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo detectar anomalías' });
  }
}

async function precios(req, res) {
  try {
    const margin = req.query.margin != null ? Number(req.query.margin) : undefined;
    const history = Math.max(7, Number(req.query.history || 90));
    const limit = Math.max(1, Number(req.query.limit || 200));
    const data = await ai.pricingRecommendations({ margin, historyDays: history, limit });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo calcular precios sugeridos' });
  }
}

module.exports = { forecast, stockouts, anomalias, precios };

