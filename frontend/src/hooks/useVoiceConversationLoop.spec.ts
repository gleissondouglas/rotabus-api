import { act, renderHook, waitFor } from "@testing-library/react-native";

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

  it("não inicia o microfone após speakAndWait sem nova ação do usuário", async () => {
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

    expect(SpeechService.startListening).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("permite falar uma mensagem sem abrir o microfone automaticamente", async () => {
    const onIntent = jest.fn();
    const { result } = renderHook(() => useVoiceConversationLoop({ onIntent }));

    await act(async () => {
      await result.current.startLoop("Encontrei algumas opções.", {
        autoListenAfterSpeech: false,
      });
    });

    expect(SpeechService.speakAndWait).toHaveBeenCalledWith("Encontrei algumas opções.");
    expect(SpeechService.startListening).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
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

  it("não processa transcrição parcial como intenção final", async () => {
    const onIntent = jest.fn();
    const onTranscript = jest.fn();
    const { result } = renderHook(() => (
      useVoiceConversationLoop({ onIntent, onTranscript })
    ));

    (SpeechService.startListening as jest.Mock).mockImplementation(({ onResult }) => {
      onResult("sim", false);
    });

    await act(async () => {
      await result.current.startLoop();
    });

    expect(onTranscript).toHaveBeenCalledWith("sim", false);
    expect(onIntent).not.toHaveBeenCalled();
    expect(vibrationService.selection).not.toHaveBeenCalled();
    expect(result.current.status).toBe("listening");
  });

  it("não processa ruído curto como destino final", async () => {
    const onIntent = jest.fn();
    const onRecognitionIssue = jest.fn();
    const { result } = renderHook(() => (
      useVoiceConversationLoop({ onIntent, onRecognitionIssue })
    ));

    (SpeechService.startListening as jest.Mock).mockImplementation(({ onResult }) => {
      onResult("ah", true);
    });

    await act(async () => {
      await result.current.startLoop();
    });

    expect(onIntent).not.toHaveBeenCalled();
    expect(onRecognitionIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "UNCLEAR_TRANSCRIPT",
        transcript: "ah",
      }),
    );
    expect(result.current.status).toBe("error");
    expect(vibrationService.error).toHaveBeenCalled();
  });

  it("continua aceitando destino curto útil como Centro", async () => {
    const onIntent = jest.fn();
    const { result } = renderHook(() => useVoiceConversationLoop({ onIntent }));

    (SpeechService.startListening as jest.Mock).mockImplementation(({ onResult }) => {
      onResult("Centro", true);
    });

    await act(async () => {
      await result.current.startLoop();
    });

    expect(onIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "DESTINATION_TEXT",
        text: "centro",
      }),
    );
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

    await waitFor(() => {
      expect(SpeechService.startListening).toHaveBeenCalledTimes(2);
    });

    expect(SpeechService.speakAndWait).toHaveBeenCalledTimes(1);
    expect(SpeechService.speakAndWait).toHaveBeenCalledWith(
      "Não consegui te ouvir. Pode repetir?",
    );
    expect(result.current.status).toBe("error");
    expect(vibrationService.error).toHaveBeenCalledTimes(1);
  });

  it("não abre a escuta ao apenas repetir uma mensagem", async () => {
    const onIntent = jest.fn();
    const { result } = renderHook(() => (
      useVoiceConversationLoop({ onIntent, maxSilentRetries: 0 })
    ));

    (SpeechService.startListening as jest.Mock).mockImplementationOnce(({ onError }) => {
      onError({ error: "no-speech", isSilentError: true });
    });

    await act(async () => {
      await result.current.startLoop("Pergunta original");
    });

    expect(SpeechService.startListening).not.toHaveBeenCalled();
    expect(SpeechService.speakAndWait).toHaveBeenCalledTimes(1);
    expect(SpeechService.speakAndWait).toHaveBeenCalledWith("Pergunta original");
    expect(result.current.status).toBe("idle");
  });

  it("só aceita o comando repetir depois de uma captura explicitamente iniciada", async () => {
    const onIntent = jest.fn();
    const { result } = renderHook(() => useVoiceConversationLoop({ onIntent }));

    (SpeechService.startListening as jest.Mock)
      .mockImplementationOnce(({ onResult }) => {
        onResult("repetir", true);
      })
      .mockResolvedValue(undefined);

    await act(async () => {
      await result.current.startLoop("Pergunta original", { autoListenAfterSpeech: true });
    });

    await waitFor(() => {
      expect(SpeechService.speakAndWait).toHaveBeenCalledTimes(2);
    });

    expect(SpeechService.speakAndWait).toHaveBeenNthCalledWith(1, "Pergunta original");
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
