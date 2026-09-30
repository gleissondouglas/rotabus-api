const { recordPassengerLocation, getBusPosition } = require('./crowdsource.service');

async function pingLocation(req, res, next) {
  try {
    const { lineId, direction, lat, lng, speed, bearing } = req.body;
    
    if (!lineId || !lat || !lng) {
      return res.status(400).json({ error: true, message: 'Dados incompletos (lineId, lat, lng são obrigatórios).' });
    }

    const deviceId = req.body.deviceId || req.headers['x-device-id'] || null;
    const success = await recordPassengerLocation({ lineId, direction, lat, lng, speed, bearing, deviceId });

    return res.status(200).json({ success });
  } catch (error) {
    next(error);
  }
}

async function getBus(req, res, next) {
  try {
    const { lineId } = req.params;
    const { direction } = req.query;
    
    if (!lineId) {
      return res.status(400).json({ error: true, message: 'ID da linha não fornecido.' });
    }

    const data = await getBusPosition(lineId, direction);
    
    if (!data) {
      return res.status(404).json({ error: true, message: 'Nenhuma informação comunitária recente para este ônibus.' });
    }

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  pingLocation,
  getBus
};
