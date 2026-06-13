const googleSpeechProvider = require("./googleSpeech.provider");

/**
 * Provedor agnóstico para transcrição de voz para texto (STT).
 * Abstrai a dependência direta de vendors específicos (ex: Google).
 */
async function transcribe(audioBase64, mimeType) {
  return googleSpeechProvider.transcribe(audioBase64, mimeType);
}

module.exports = {
  transcribe,
};
