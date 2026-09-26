/**
 * Testes do SpeechService com SpeechRecognitionModule DISPONÍVEL.
 */

const mockRemove = jest.fn();
const mockListeners: Record<string, ((...args: any[]) => void)[]> = {};

const mockSpeechRecModule = {
  requestPermissionsAsync: jest.fn(),
  addListener: jest.fn((event: string, callback: (...args: any[]) => void) => {
    if (!mockListeners[event]) mockListeners[event] = [];
    mockListeners[event].push(callback);
    return { remove: mockRemove };
  }),
  start: jest.fn(),
  stop: jest.fn(),
  setCategoryIOS: jest.fn(),
  setAudioSessionActiveIOS: jest.fn(),
};

function fireListener(event: string, data?: any) {
  const listeners = mockListeners[event] || [];
  listeners.forEach((cb) => cb(data));
}

jest.mock("@react-native-community/netinfo", () => ({
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
  addEventListener: jest.fn(),
  useNetInfo: jest.fn(),
}));

let speechService: any;
let AudioMock: any;

describe("SpeechService (com SpeechRecognitionModule disponível)", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    Object.keys(mockListeners).forEach((key) => delete mockListeners[key]);
    
    // Configurar Mocks
    jest.doMock("expo-speech-recognition", () => ({
      ExpoSpeechRecognitionModule: mockSpeechRecModule,
      default: mockSpeechRecModule
    }));

    jest.doMock("expo-speech", () => ({
      speak: jest.fn(),
      stop: jest.fn(),
    }));

    jest.doMock("expo-av", () => ({
      Audio: {
        Sound: {
          createAsync: jest.fn().mockResolvedValue({
            sound: {
              playAsync: jest.fn(),
              stopAsync: jest.fn(),
              unloadAsync: jest.fn(),
              getStatusAsync: jest.fn().mockResolvedValue({ isLoaded: false }),
              setOnPlaybackStatusUpdate: jest.fn(),
            },
          }),
        },
        setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
      },
    }));

    jest.doMock("expo-secure-store", () => ({
      getItemAsync: jest.fn().mockResolvedValue(null),
      setItemAsync: jest.fn(),
      deleteItemAsync: jest.fn(),
    }));

    jest.doMock("react-native", () => ({
      Platform: { OS: "ios" },
      Alert: { alert: jest.fn() },
    }));

    jest.doMock("../config/voice.config", () => ({
      VOICE_CONFIG: {
        provider: "LOCAL",
        googleApiKey: "",
        googleVoice: { languageCode: "pt-BR", name: "pt-BR-Neural2-A", ssmlGender: "FEMALE" },
        localVoice: { language: "pt-BR", rate: 0.9, pitch: 1.1 },
      },
    }));

    jest.doMock("../constants/storage", () => ({
      STORAGE_KEYS: { ACCESSIBILITY_SETTINGS: "accessibility_settings" },
    }));

    speechService = require("../services/speech.service");
    AudioMock = require("expo-av").Audio;
  });

  it("deve retornar true em isSpeechRecognitionAvailable", () => {
    expect(speechService.isSpeechRecognitionAvailable()).toBe(true);
  });

  describe("startListening", () => {
    it("deve iniciar escuta com permissão concedida e registrar listeners", async () => {
      mockSpeechRecModule.requestPermissionsAsync.mockResolvedValue({
        granted: true,
        status: "granted",
      });

      const onResult = jest.fn();
      const onError = jest.fn();
      const onStart = jest.fn();
      const onEnd = jest.fn();

      await speechService.startListening({ onResult, onError, onStart, onEnd });

      expect(mockSpeechRecModule.setCategoryIOS).toHaveBeenCalledWith(
        expect.objectContaining({ category: "playAndRecord" })
      );
      expect(mockSpeechRecModule.setAudioSessionActiveIOS).toHaveBeenCalledWith(true);
      expect(AudioMock.setAudioModeAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        })
      );
      expect(mockSpeechRecModule.addListener).toHaveBeenCalledWith("result", expect.any(Function));
      expect(mockSpeechRecModule.addListener).toHaveBeenCalledWith("error", expect.any(Function));
      expect(mockSpeechRecModule.addListener).toHaveBeenCalledWith("start", expect.any(Function));
      expect(mockSpeechRecModule.addListener).toHaveBeenCalledWith("end", expect.any(Function));
      expect(mockSpeechRecModule.addListener).toHaveBeenCalledWith("volumechange", expect.any(Function));
      expect(mockSpeechRecModule.start).toHaveBeenCalledWith(
        expect.objectContaining({ lang: "pt-BR", interimResults: true, maxAlternatives: 3 })
      );
    });

    it("deve chamar onResult com transcrição final (listener result)", async () => {
      mockSpeechRecModule.requestPermissionsAsync.mockResolvedValue({ granted: true, status: "granted" });
      const onResult = jest.fn();
      await speechService.startListening({ onResult, onError: jest.fn() });
      fireListener("result", { results: [{ transcript: "Praça Rui Barbosa", isFinal: true }] });
      expect(onResult).toHaveBeenCalledWith("Praça Rui Barbosa", true);
    });

    it("deve chamar onResult com transcrição parcial via event.transcript", async () => {
      mockSpeechRecModule.requestPermissionsAsync.mockResolvedValue({ granted: true, status: "granted" });
      const onResult = jest.fn();
      await speechService.startListening({ onResult, onError: jest.fn() });
      fireListener("result", { transcript: "Centro de" });
      expect(onResult).toHaveBeenCalledWith("Centro de", true);
    });

    it("deve tratar resultado com isFinal explícito como false (parcial)", async () => {
      mockSpeechRecModule.requestPermissionsAsync.mockResolvedValue({ granted: true, status: "granted" });
      const onResult = jest.fn();
      await speechService.startListening({ onResult, onError: jest.fn() });
      fireListener("result", { results: [{ transcript: "Cen", isFinal: false }], isFinal: false });
      expect(onResult).toHaveBeenCalledWith("Cen", false);
    });

    it("deve ignorar transcrições vazias", async () => {
      mockSpeechRecModule.requestPermissionsAsync.mockResolvedValue({ granted: true, status: "granted" });
      const onResult = jest.fn();
      await speechService.startListening({ onResult, onError: jest.fn() });
      fireListener("result", { results: [{ transcript: "   ", isFinal: true }] });
      expect(onResult).not.toHaveBeenCalled();
    });

    it("deve chamar onError com mensagem de silêncio para erro no-speech", async () => {
      mockSpeechRecModule.requestPermissionsAsync.mockResolvedValue({ granted: true, status: "granted" });
      const onError = jest.fn();
      await speechService.startListening({ onResult: jest.fn(), onError });
      fireListener("error", { error: "no-speech" });
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ error: "no-speech", isSilentError: true }));
    });

    it("deve chamar onError com evento original para erro genérico", async () => {
      mockSpeechRecModule.requestPermissionsAsync.mockResolvedValue({ granted: true, status: "granted" });
      const onError = jest.fn();
      await speechService.startListening({ onResult: jest.fn(), onError });
      const genericError = { error: "audio", message: "Audio capture error" };
      fireListener("error", genericError);
      expect(onError).toHaveBeenCalledWith(genericError);
    });

    it("deve chamar onStart quando listener start é acionado", async () => {
      mockSpeechRecModule.requestPermissionsAsync.mockResolvedValue({ granted: true, status: "granted" });
      const onStart = jest.fn();
      await speechService.startListening({ onResult: jest.fn(), onError: jest.fn(), onStart });
      fireListener("start");
      expect(onStart).toHaveBeenCalled();
    });

    it("deve chamar onEnd e limpar listeners quando listener end é acionado", async () => {
      mockSpeechRecModule.requestPermissionsAsync.mockResolvedValue({ granted: true, status: "granted" });
      const onEnd = jest.fn();
      await speechService.startListening({ onResult: jest.fn(), onError: jest.fn(), onEnd });
      fireListener("end");
      expect(onEnd).toHaveBeenCalled();
      expect(mockRemove).toHaveBeenCalled();
    });

    it("deve processar evento volumechange sem erro", async () => {
      mockSpeechRecModule.requestPermissionsAsync.mockResolvedValue({ granted: true, status: "granted" });
      await speechService.startListening({ onResult: jest.fn(), onError: jest.fn() });
      expect(() => fireListener("volumechange", { value: 0.5 })).not.toThrow();
    });

    it("deve chamar onError com permission-denied quando permissão não é concedida", async () => {
      mockSpeechRecModule.requestPermissionsAsync.mockResolvedValue({ granted: false, status: "denied" });
      const onError = jest.fn();
      await speechService.startListening({ onResult: jest.fn(), onError });
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ error: "permission-denied" }));
    });

    it("deve tratar erro em setCategoryIOS silenciosamente", async () => {
      mockSpeechRecModule.setCategoryIOS.mockImplementation(() => { throw new Error("Category error"); });
      mockSpeechRecModule.requestPermissionsAsync.mockResolvedValue({ granted: true, status: "granted" });
      const onError = jest.fn();
      await speechService.startListening({ onResult: jest.fn(), onError });
      expect(mockSpeechRecModule.start).toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it("deve chamar onError quando start lança exceção inesperada", async () => {
      mockSpeechRecModule.requestPermissionsAsync.mockResolvedValue({ granted: true, status: "granted" });
      mockSpeechRecModule.start.mockImplementation(() => { throw new Error("Unexpected native error"); });
      const onError = jest.fn();
      await speechService.startListening({ onResult: jest.fn(), onError });
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "Unexpected native error" }));
    });
  });

  describe("stopListening", () => {
    it("deve chamar stop nativo e desativar sessão iOS", () => {
      speechService.stopListening();
      expect(mockSpeechRecModule.stop).toHaveBeenCalled();
      expect(mockSpeechRecModule.setAudioSessionActiveIOS).toHaveBeenCalledWith(false);
    });

    it("deve tratar erro silenciosamente no stopListening", () => {
      mockSpeechRecModule.stop.mockImplementation(() => { throw new Error("Stop error"); });
      expect(() => speechService.stopListening()).not.toThrow();
    });
  });
});
