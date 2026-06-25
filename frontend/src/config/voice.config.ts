export const VOICE_CONFIG = {
  // Escolha o provedor: "GOOGLE" ou "LOCAL"
  provider: "LOCAL",
  // A chave agora deve ficar apenas no Back-end
  googleApiKey: "",

  // Configurações da voz do Google
  googleVoice: {
    languageCode: "pt-BR",
    name: "pt-BR-Neural2-A",
    ssmlGender: "FEMALE",
  },

  // Configurações da voz local (fallback) - OTIMIZADA
  localVoice: {
    language: "pt-BR",
    rate: 0.9, // Um pouco mais calmo (antes era 0.85 ou 0.9)
    pitch: 1.1, // Um tom levemente mais agudo costuma soar menos metálico/robótico
  },
};
