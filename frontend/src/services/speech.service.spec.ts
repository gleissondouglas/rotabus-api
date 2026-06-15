import * as Speech from "expo-speech";
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";
import { speak, speakAndWait, startListening, stopSpeaking } from "./speech.service";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
}));

jest.mock("expo-speech-recognition", () => ({
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync: jest.fn(),
    addListener: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    setCategoryIOS: jest.fn(),
    setAudioSessionActiveIOS: jest.fn(),
  },
}));

jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-av", () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(),
    },
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("../config/voice.config", () => ({
  VOICE_CONFIG: {
    provider: "LOCAL",
    googleApiKey: "",
    googleVoice: {
      languageCode: "pt-BR",
      name: "pt-BR-Neural2-A",
      ssmlGender: "FEMALE",
    },
    localVoice: {
      language: "pt-BR",
      rate: 0.8,
      pitch: 1.1,
    },
  },
}));

async function waitForSpeechSpeakCall() {
  for (let i = 0; i < 10; i++) {
    if ((Speech.speak as jest.Mock).mock.calls.length > 0) {
      return;
    }
    await Promise.resolve();
  }
}

describe("speech.service", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useRealTimers();
    await stopSpeaking();
  });

  it("mantém speak sem aguardar o fim do TTS local", async () => {
    await speak("Olá");

    expect(Speech.speak).toHaveBeenCalledWith(
      "Olá",
      expect.objectContaining({
        language: "pt-BR",
        rate: 0.8,
      })
    );
  });

  it("speakAndWait resolve quando o TTS local dispara onDone", async () => {
    let options: any;
    (Speech.speak as jest.Mock).mockImplementation((_text, speechOptions) => {
      options = speechOptions;
    });

    const promise = speakAndWait("Olá");
    await waitForSpeechSpeakCall();

    let resolved = false;
    promise.then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    options.onDone();
    await promise;
    expect(resolved).toBe(true);
  });

  it("speakAndWait não deixa promessa pendurada quando stopSpeaking é chamado", async () => {
    (Speech.speak as jest.Mock).mockImplementation(() => {});

    const promise = speakAndWait("Olá");
    await waitForSpeechSpeakCall();

    let resolved = false;
    promise.then(() => {
      resolved = true;
    });

    await stopSpeaking();
    await promise;

    expect(resolved).toBe(true);
    expect(Speech.stop).toHaveBeenCalled();
  });

  it("inicia reconhecimento em pt-BR e só marca parcial quando a biblioteca informa isFinal", async () => {
    jest.useFakeTimers();

    const listeners: Record<string, (event: any) => void> = {};
    const onResult = jest.fn();

    (ExpoSpeechRecognitionModule.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: true,
      status: "granted",
    });
    (ExpoSpeechRecognitionModule.addListener as jest.Mock).mockImplementation(
      (eventName: string, callback: (event: any) => void) => {
        listeners[eventName] = callback;
        return { remove: jest.fn() };
      },
    );

    const startPromise = startListening({
      onResult,
      onError: jest.fn(),
    });

    await Promise.resolve();
    jest.advanceTimersByTime(500);
    await startPromise;

    expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledWith(
      expect.objectContaining({
        lang: "pt-BR",
        interimResults: true,
        maxAlternatives: 3,
        contextualStrings: expect.arrayContaining(["Centro", "Shopping Uberaba"]),
      }),
    );

    listeners.result({
      results: [{ transcript: "Centro", confidence: 0.9, segments: [] }],
    });

    expect(onResult).toHaveBeenCalledWith("Centro", true);

    onResult.mockClear();
    listeners.result({
      isFinal: false,
      results: [{ transcript: "Cen", confidence: 0, segments: [] }],
    });

    expect(onResult).toHaveBeenCalledWith("Cen", false);
  });
});
