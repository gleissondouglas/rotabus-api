const redisClient = require('../../config/redis');

const REDIS_KEY_PREFIX = 'bus_position:';

/**
 * Registra a posição de um passageiro que clicou em "Embarquei no ônibus".
 * Os dados do celular dele (anônimos) se tornam o GPS comunitário do ônibus.
 */
async function recordPassengerLocation({ lineId, direction, lat, lng, speed, bearing }) {
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
      source: 'crowdsourcing' // Indica que veio da comunidade
    };

    // Salva a localização da linha geral no Redis
    // Usa um TTL (expiração) de 120 segundos.
    await redisClient.set(
      `${REDIS_KEY_PREFIX}${cleanLineId}`, 
      JSON.stringify(positionData), 
      'EX', 
      120 
    );

    // Se houver sentido/direção especificada, salva também com a chave específica da direção
    if (cleanDirection) {
      await redisClient.set(
        `${REDIS_KEY_PREFIX}${cleanLineId}:${cleanDirection}`, 
        JSON.stringify(positionData), 
        'EX', 
        120 
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
