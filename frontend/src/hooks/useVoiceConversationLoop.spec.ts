import { act, renderHook } from "@testing-library/react-native";

import { useVoiceConversationLoop } from "./useVoiceConversationLoop";
import * as SpeechService from "../services/speech.service";
import { vibrationService } from "../services/vibration.service";

jest.mock("../services/speech.service", () => ({
  speakAndWait: jest.fn(),
  stopSpeaking: jest.fn(),
  startListening: jest.fn(),
  stopListening: jest.fn(),
  isSpeechRecognitionAvailable: jest.fn(() => true),
}));

jest.mock("../services/vibration.service", () => ({
  vibrationService: {
    medium: jest.fn(),
    selection: jest.fn(),
    light: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("expo-router", () => {
  const ReactModule = jest.requireActual("react");

  return {
    useFocusEffect: (callback: () => void | (() => void)) => {
      ReactModule.useEffect(() => callback(), [callback]);
    },
  };
});

function createDeferredPromise() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolver) => {
    resolve = resolver;
  });

  return { promise, resolve };
}

describe("useVoiceConversationLoop", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SpeechService.speakAndWait as jest.Mock).mockResolvedValue(undefined);
    (SpeechService.startListening as jest.Mock).mockResolvedValue(undefined);
  });

  it("não inicia o microfone antes de speakAndWait terminar", async () => {
    const onIntent = jest.fn();
    const deferred = createDeferredPromise();
    (SpeechService.speakAndWait as jest.Mock).mockReturnValue(deferred.promise);

    const { result } = renderHook(() => useVoiceConversationLoop({ onIntent }));

    let startPromise: Promise<void>;
    await act(async () => {
      startPromise = result.current.startLoop("Olá, Douglas. Para onde você quer ir hoje?");
      await Promise.resolve();
    });

    expect(result.current.status).toBe("speaking");
    expect(SpeechService.startListening).not.toHaveBeenCalled();

    await act(async () => {
      deferred.resolve();
      await startPromise!;
    });

    expect(SpeechService.startListening).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("listening");
  });

  it("processa a intenção final capturada pelo microfone", async () => {
    const onIntent = jest.fn();
    const { result } = renderHook(() => useVoiceConversationLoop({ onIntent }));

    (SpeechService.startListening as jest.Mock).mockImplementation(({ onResult }) => {
      onResult("sim", true);
    });

    await act(async () => {
      await result.current.startLoop();
    });

    expect(onIntent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "CONFIRM" }),
    );
    expect(result.current.status).toBe("processing");
    expect(vibrationService.selection).toHaveBeenCalled();
  });

  it("limita o retry de silêncio a uma tentativa e termina em erro", async () => {
    const onIntent = jest.fn();
    const { result } = renderHook(() => useVoiceConversationLoop({ onIntent }));

    (SpeechService.startListening as jest.Mock)
      .mockImplementationOnce(({ onError }) => {
        onError({ error: "no-speech", isSilentError: true });
      })
      .mockImplementationOnce(({ onError }) => {
        onError({ error: "no-speech", isSilentError: true });
      });

    await act(async () => {
      await result.current.startLoop();
    });

    expect(SpeechService.speakAndWait).toHaveBeenCalledTimes(1);
    expect(SpeechService.speakAndWait).toHaveBeenCalledWith(
      "Não consegui te ouvir. Pode repetir?",
    );
    expect(SpeechService.startListening).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("error");
    expect(vibrationService.error).toHaveBeenCalledTimes(1);
  });

  it("repete a última fala quando recebe o comando repetir", async () => {
    const onIntent = jest.fn();
    const { result } = renderHook(() => useVoiceConversationLoop({ onIntent }));

    (SpeechService.startListening as jest.Mock)
      .mockImplementationOnce(({ onResult }) => {
        onResult("repetir", true);
      })
      .mockResolvedValue(undefined);

    await act(async () => {
      await result.current.startLoop("Pergunta original");
    });

    expect(SpeechService.speakAndWait).toHaveBeenCalledTimes(2);
    expect(SpeechService.speakAndWait).toHaveBeenNthCalledWith(1, "Pergunta original");
    expect(SpeechService.speakAndWait).toHaveBeenNthCalledWith(2, "Pergunta original");
    expect(onIntent).not.toHaveBeenCalled();
  });

  it("faz cleanup de fala e escuta ao desmontar", async () => {
    const onIntent = jest.fn();
    const { unmount } = renderHook(() => useVoiceConversationLoop({ onIntent }));

    unmount();
    await act(async () => {
      await Promise.resolve();
    });

    expect(SpeechService.stopSpeaking).toHaveBeenCalled();
    expect(SpeechService.stopListening).toHaveBeenCalled();
  });
});
