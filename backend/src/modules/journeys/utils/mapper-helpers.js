/**
 * Extrai o nome curto de um ponto (remove a parte após a vírgula).
 */
function getShortStopName(stopName) {
  if (!stopName) return "ponto não identificado";
  return stopName.split(",")[0].trim();
}

/**
 * Converte um texto de duração (ex: "1200s") em segundos.
 */
function getSecondsFromDuration(durationText) {
  if (!durationText) return 0;
  return parseInt(String(durationText).replace("s", ""), 10) || 0;
}

/**
 * Remove tags HTML de uma string.
 */
function stripHtmlTags(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>?/gm, '');
}

module.exports = {
  getShortStopName,
  getSecondsFromDuration,
  stripHtmlTags,
};
