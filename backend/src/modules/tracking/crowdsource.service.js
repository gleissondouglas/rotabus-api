const redisClient = require('../../config/redis');

const REDIS_KEY_PREFIX = 'bus_position:';

/**
 * Registra a posição de um passageiro que clicou em "Embarquei no ônibus".
 * Os dados do celular dele (anônimos) se tornam o GPS comunitário do ônibus.
 */
async function recordPassengerLocation({ lineId, direction, lat, lng, speed, bearing, deviceId }) {
  try {
    if (!lineId || !lat || !lng) return false;

    // Remove espaços/caracteres indesejados da linha (ex: "305 - Centro" -> "305-Centro")
    const cleanLineId = String(lineId).trim().replace(/\s+/g, '-');
    const cleanDirection = direction
      ? String(direction).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-')
      : null;

    const positionData = {
      lat,
      lng,
      speed: speed || 0,
      bearing: bearing || null,
      direction: direction || null,
      timestamp: Math.floor(Date.now() / 1000),
      source: 'crowdsourcing',
      deviceId: deviceId || null,
    };

    // TTL calibrado para 45 segundos (evita ônibus fantasmas congelados na tela)
    const BUS_POSITION_TTL_SECONDS = 45;

    // Salva a localização individual do dispositivo para diferenciar múltiplos ônibus da mesma linha
    if (deviceId) {
      await redisClient.set(
        `${REDIS_KEY_PREFIX}${cleanLineId}:dev:${deviceId}`,
        JSON.stringify(positionData),
        'EX',
        BUS_POSITION_TTL_SECONDS
      );
    }

    // Salva a localização da linha geral no Redis
    await redisClient.set(
      `${REDIS_KEY_PREFIX}${cleanLineId}`, 
      JSON.stringify(positionData), 
      'EX', 
      BUS_POSITION_TTL_SECONDS 
    );

    // Se houver sentido/direção especificada, salva também com a chave específica da direção
    if (cleanDirection) {
      await redisClient.set(
        `${REDIS_KEY_PREFIX}${cleanLineId}:${cleanDirection}`, 
        JSON.stringify(positionData), 
        'EX', 
        BUS_POSITION_TTL_SECONDS 
      );
    }

    return true;
  } catch (error) {
    console.error('[CROWDSOURCING] Erro ao gravar posição:', error.message);
    return false;
  }
}

/**
 * Consulta a última posição comunitária do ônibus (opcionalmente filtrada por sentido)
 */
async function getBusPosition(lineId, direction = null) {
  const cleanLineId = String(lineId).trim().replace(/\s+/g, '-');
  const cleanDirection = direction
    ? String(direction).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-')
    : null;

  if (cleanDirection) {
    const dirData = await redisClient.get(`${REDIS_KEY_PREFIX}${cleanLineId}:${cleanDirection}`);
    if (dirData) {
      try {
        return JSON.parse(dirData);
      } catch {
        // Dado corrompido no Redis — ignora e tenta a chave geral
      }
    }
  }

  const data = await redisClient.get(`${REDIS_KEY_PREFIX}${cleanLineId}`);
  if (!data) return null; // Sem passageiros compartilhando ou GPS expirou
  try {
    return JSON.parse(data);
  } catch {
    // Dado corrompido no Redis — retorna null como se não houvesse dados
    return null;
  }
}

module.exports = {
  recordPassengerLocation,
  getBusPosition
};
