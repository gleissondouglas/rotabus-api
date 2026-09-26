import * as Speech from "expo-speech";
import { Audio } from "expo-av";
import { Alert } from "react-native";
import * as SecureStore from "expo-secure-store";
import { VOICE_CONFIG } from "../config/voice.config";
import { STORAGE_KEYS } from "../constants/storage";

const mockUnload = jest.fn().mockResolvedValue(undefined);
const mockStopSound = jest.fn().mockResolvedValue(undefined);
const mockPlay = jest.fn().mockResolvedValue(undefined);
const mockGetStatus = jest.fn().mockResolvedValue({ isLoaded: true });
const mockSetCallback = jest.fn();

jest.mock("@react-native-community/netinfo", () => ({
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
  addEventListener: jest.fn(),
  useNetInfo: jest.fn(),
}));

jest.mock("expo-speech", () => ({
  speak: jest.fn((_text, options) => {
    if (options?.onDone) setTimeout(options.onDone, 10);
    if (options?.onStart) setTimeout(options.onStart, 0);
  }),
  stop: jest.fn(),
}));

jest.mock("expo-av", () => {
  return {
    Audio: {
      Sound: {
        createAsync: jest.fn().mockImplementation(() =>
          Promise.resolve({
            sound: {
              playAsync: mockPlay,
              stopAsync: mockStopSound,
              unloadAsync: mockUnload,
              getStatusAsync: mockGetStatus,
              setOnPlaybackStatusUpdate: mockSetCallback,
            },
          })
        ),
      },
      setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    },
  };
});

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
  Alert: { alert: jest.fn() },
}));

jest.mock("../config/voice.config", () => ({
  VOICE_CONFIG: {
    provider: "LOCAL",
    googleApiKey: "",
    googleVoice: { languageCode: "pt-BR", name: "pt-BR-Neural2-A", ssmlGender: "FEMALE" },
    localVoice: { language: "pt-BR", rate: 0.9, pitch: 1.1 },
  },
}));

jest.mock("../constants/storage", () => ({
  STORAGE_KEYS: { ACCESSIBILITY_SETTINGS: "accessibility_settings" },
}));

async function waitForMicrotasks() {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

// Helper to enable Google TTS mode for tests
function enableGoogleTTS() {
  (VOICE_CONFIG as any).provider = "GOOGLE";
  (VOICE_CONFIG as any).googleApiKey = "fake-google-api-key";
}

function mockGoogleFetchSuccess(audioContent = "mockBase64AudioData") {
  global.fetch = jest.fn().mockResolvedValue({
    json: jest.fn().mockResolvedValue({ audioContent }),
  } as any);
}

function mockGoogleFetchNoAudio() {
  global.fetch = jest.fn().mockResolvedValue({
    json: jest.fn().mockResolvedValue({}),
  } as any);
}

describe("SpeechService", () => {
  const originalFetch = global.fetch;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (VOICE_CONFIG as any).provider = "LOCAL";
    (VOICE_CONFIG as any).googleApiKey = "";
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    mockGetStatus.mockResolvedValue({ isLoaded: true });
    // Import fresh and reset state
    const { stopSpeaking } = require("../services/speech.service");
    jest.useRealTimers();
    await stopSpeaking();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  describe("speak", () => {
    it("deve chamar Speech.speak com o texto e configurações de voz local", async () => {
      const { speak } = require("../services/speech.service");
      await speak("Olá, bem-vindo ao RotaBus!");

      expect(Speech.speak).toHaveBeenCalledWith(
        "Olá, bem-vindo ao RotaBus!",
        expect.objectContaining({
          language: "pt-BR",
          rate: 0.9,
          pitch: 1.1,
          onStart: expect.any(Function),
        })
      );
    });

    it("deve chamar stopSpeaking antes de falar", async () => {
      const { speak } = require("../services/speech.service");
      await speak("Testando interrupção prévia");

      expect(Speech.stop).toHaveBeenCalled();
      const stopOrder = (Speech.stop as jest.Mock).mock.invocationCallOrder[0];
      const speakOrder = (Speech.speak as jest.Mock).mock.invocationCallOrder[0];
      expect(stopOrder).toBeLessThan(speakOrder);
    });

    it("deve ajustar a velocidade da fala quando a opção de voz lenta estiver ativada", async () => {
      const { speak } = require("../services/speech.service");
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({ slowVoice: true })
      );

      await speak("Mensagem com voz lenta");

      expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
        STORAGE_KEYS.ACCESSIBILITY_SETTINGS
      );
      expect(Speech.speak).toHaveBeenCalledWith(
        "Mensagem com voz lenta",
        expect.objectContaining({
          rate: 0.7,
        })
      );
    });

    it("deve tratar erro silenciosamente ao buscar configurações de acessibilidade (linha 107)", async () => {
      const { speak } = require("../services/speech.service");
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(
        new Error("SecureStore error")
      );

      // Não deve lançar erro, deve usar rate padrão
      await speak("Texto com erro de config");

      expect(Speech.speak).toHaveBeenCalledWith(
        "Texto com erro de config",
        expect.objectContaining({ rate: 0.9 })
      );
    });

    it("deve usar Google TTS quando configurado e fazer fallback para local se sem audioContent", async () => {
      const { speak } = require("../services/speech.service");
      enableGoogleTTS();
      mockGoogleFetchNoAudio();

      await speak("Texto sem áudio Google");

      // Deve ter tentado o Google
      expect(global.fetch).toHaveBeenCalled();
      // Deve ter feito fallback para voz local
      expect(Speech.speak).toHaveBeenCalledWith(
        "Texto sem áudio Google",
        expect.objectContaining({ language: "pt-BR" })
      );
    });

    it("deve usar Google TTS com sucesso e reproduzir áudio (linhas 136-169)", async () => {
      const { speak } = require("../services/speech.service");
      enableGoogleTTS();
      mockGoogleFetchSuccess();

      await speak("Texto Google TTS");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("texttospeech.googleapis.com"),
        expect.objectContaining({ method: "POST" })
      );
      expect(Audio.Sound.createAsync).toHaveBeenCalledWith(
        { uri: "data:audio/mp3;base64,mockBase64AudioData" },
        { shouldPlay: false }
      );
      expect(mockSetCallback).toHaveBeenCalled();
      expect(mockPlay).toHaveBeenCalled();
      // speak (não speakAndWait) não deve aguardar completação
      expect(Speech.speak).not.toHaveBeenCalled();
    });

    it("deve fazer fallback para voz local quando fetch do Google lança erro (linha 176)", async () => {
      const { speak } = require("../services/speech.service");
      enableGoogleTTS();
      global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

      await speak("Texto com rede falhando");

      // Deve ter feito fallback para voz local
      expect(Speech.speak).toHaveBeenCalledWith(
        "Texto com rede falhando",
        expect.objectContaining({ language: "pt-BR" })
      );
    });

    it("deve retornar silenciosamente quando fetch lança AbortError (linhas 172-174)", async () => {
      const { speak } = require("../services/speech.service");
      enableGoogleTTS();
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      global.fetch = jest.fn().mockRejectedValue(abortError);

      await speak("Texto cancelado");

      // Não deve fazer fallback para voz local
      expect(Speech.speak).not.toHaveBeenCalled();
    });

    it("deve usar speakingRate 0.75 no Google TTS com voz lenta ativada", async () => {
      const { speak } = require("../services/speech.service");
      enableGoogleTTS();
      mockGoogleFetchSuccess();
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({ slowVoice: true })
      );

      await speak("Texto Google lento");

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.audioConfig.speakingRate).toBe(0.75);
    });
  });

  describe("speakAndWait", () => {
    it("deve resolver quando a fala terminar (via onDone callback)", async () => {
      const { speakAndWait } = require("../services/speech.service");
      let doneCallback: (() => void) | undefined;
      (Speech.speak as jest.Mock).mockImplementationOnce((_text: string, options: any) => {
        doneCallback = options?.onDone;
      });

      let finished = false;
      const promise = speakAndWait("Texto para aguardar");
      promise.then(() => { finished = true; });

      await waitForMicrotasks();
      expect(finished).toBe(false);

      expect(doneCallback).toBeDefined();
      doneCallback!();

      await promise;
      expect(finished).toBe(true);
    });

    it("deve resolver quando a fala for interrompida por stopSpeaking", async () => {
      const { speakAndWait, stopSpeaking } = require("../services/speech.service");
      (Speech.speak as jest.Mock).mockImplementationOnce(() => {});

      let finished = false;
      const promise = speakAndWait("Texto em andamento");
      promise.then(() => { finished = true; });

      await waitForMicrotasks();
      expect(finished).toBe(false);

      await stopSpeaking();
      await promise;

      expect(finished).toBe(true);
      expect(Speech.stop).toHaveBeenCalled();
    });

    it("deve resolver quando ocorrer onStopped ou onError no TTS local", async () => {
      const { speakAndWait } = require("../services/speech.service");
      let stoppedCallback: (() => void) | undefined;
      (Speech.speak as jest.Mock).mockImplementationOnce((_text: string, options: any) => {
        stoppedCallback = options?.onStopped;
      });

      const promiseStopped = speakAndWait("Texto interrompido");
      await waitForMicrotasks();
      expect(stoppedCallback).toBeDefined();
      stoppedCallback!();
      await expect(promiseStopped).resolves.toBeUndefined();

      let errorCallback: (() => void) | undefined;
      (Speech.speak as jest.Mock).mockImplementationOnce((_text: string, options: any) => {
        errorCallback = options?.onError;
      });

      const promiseError = speakAndWait("Texto com erro");
      await waitForMicrotasks();
      expect(errorCallback).toBeDefined();
      errorCallback!();
      await expect(promiseError).resolves.toBeUndefined();
    });

    it("deve aguardar completação do Google TTS com speakAndWait (linhas 163-166)", async () => {
      const { speakAndWait, stopSpeaking } = require("../services/speech.service");
      enableGoogleTTS();
      mockGoogleFetchSuccess();

      let finished = false;
      const promise = speakAndWait("Texto Google aguardado");
      promise.then(() => { finished = true; });

      await waitForMicrotasks();
      // Deve ter configurado o callback
      expect(mockSetCallback).toHaveBeenCalled();
      expect(finished).toBe(false);

      // Simular o callback de playback completado - aciona settlePendingSpeechCompletion
      // via stopSpeaking (já que não temos acesso direto ao resolve)
      await stopSpeaking();
      await promise;
      expect(finished).toBe(true);
    });

    it("deve descarregar som e resolver quando playback terminar (linhas 153-158)", async () => {
      const { speak } = require("../services/speech.service");
      enableGoogleTTS();
      mockGoogleFetchSuccess();

      await speak("Texto Google com callback");

      // O setOnPlaybackStatusUpdate deve ter sido chamado
      expect(mockSetCallback).toHaveBeenCalled();
      const statusCallback = mockSetCallback.mock.calls[0][0];

      // Simular o callback de playback finalizado
      statusCallback({ isLoaded: true, didJustFinish: true });

      expect(mockUnload).toHaveBeenCalled();
    });

    it("não deve descarregar quando playback status não é didJustFinish", async () => {
      const { speak } = require("../services/speech.service");
      enableGoogleTTS();
      mockGoogleFetchSuccess();
      mockUnload.mockClear();

      await speak("Texto Google em progresso");

      expect(mockSetCallback).toHaveBeenCalled();
      const statusCallback = mockSetCallback.mock.calls[0][0];

      // Status sem didJustFinish
      statusCallback({ isLoaded: true, didJustFinish: false });
      expect(mockUnload).not.toHaveBeenCalled();

      // Status com isLoaded false
      statusCallback({ isLoaded: false });
      expect(mockUnload).not.toHaveBeenCalled();
    });
  });

  describe("stopSpeaking", () => {
    it("deve chamar Speech.stop", async () => {
      const { stopSpeaking } = require("../services/speech.service");
      await stopSpeaking();
      expect(Speech.stop).toHaveBeenCalled();
    });

    it("deve parar e descarregar som do Audio.Sound se existir", async () => {
      const { speak, stopSpeaking } = require("../services/speech.service");
      enableGoogleTTS();
      mockGoogleFetchSuccess();

      await speak("Reproduzindo áudio do Google");

      expect(Audio.Sound.createAsync).toHaveBeenCalledWith(
        { uri: "data:audio/mp3;base64,mockBase64AudioData" },
        { shouldPlay: false }
      );
      expect(mockPlay).toHaveBeenCalled();

      await stopSpeaking();

      expect(mockGetStatus).toHaveBeenCalled();
      expect(mockStopSound).toHaveBeenCalled();
      expect(mockUnload).toHaveBeenCalled();
    });

    it("não deve chamar stopAsync/unloadAsync se o som não estiver carregado", async () => {
      const { speak, stopSpeaking } = require("../services/speech.service");
      enableGoogleTTS();
      mockGoogleFetchSuccess();

      await speak("Áudio que não carregou");

      mockGetStatus.mockResolvedValueOnce({ isLoaded: false });
      mockStopSound.mockClear();
      mockUnload.mockClear();

      await stopSpeaking();

      expect(mockGetStatus).toHaveBeenCalled();
      expect(mockStopSound).not.toHaveBeenCalled();
      expect(mockUnload).not.toHaveBeenCalled();
    });

    it("deve tratar silenciosamente erros ao descarregar som já finalizado", async () => {
      const { speak, stopSpeaking } = require("../services/speech.service");
      enableGoogleTTS();
      mockGoogleFetchSuccess();

      await speak("Áudio com erro no unload");

      mockGetStatus.mockRejectedValueOnce(new Error("Sound already unloaded"));

      await expect(stopSpeaking()).resolves.not.toThrow();
    });
  });

  describe("isSpeechRecognitionAvailable", () => {
    it("deve retornar false quando módulo não está disponível", () => {
      const { isSpeechRecognitionAvailable } = require("../services/speech.service");
      const isAvailable = isSpeechRecognitionAvailable();
      expect(isAvailable).toBe(false);
    });
  });

  describe("startListening", () => {
    it("deve chamar onError quando módulo não está disponível", async () => {
      const { startListening } = require("../services/speech.service");
      const onResult = jest.fn();
      const onError = jest.fn();

      await startListening({ onResult, onError });

      expect(Alert.alert).toHaveBeenCalledWith(
        "Não consegui ouvir agora",
        "O recurso de voz não está disponível neste dispositivo."
      );
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Module not available" })
      );
      expect(onResult).not.toHaveBeenCalled();
    });
  });

  describe("stopListening", () => {
    it("não deve lançar erro quando módulo não está disponível", () => {
      const { stopListening } = require("../services/speech.service");
      expect(() => {
        stopListening();
      }).not.toThrow();
    });
  });
});
