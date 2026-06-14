import { renderHook, act } from "@testing-library/react-native";
import { useVoiceConversationLoop } from "./useVoiceConversationLoop";
import * as SpeechService from "../services/speech.service";
import { vibrationService } from "../services/vibration.service";

// Mock das dependências
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

// Mock do expo-router para o useFocusEffect
// O useFocusEffect do expo-router recebe um callback que é executado quando foca.
jest.mock("expo-router", () => ({
  useFocusEffect: jest.fn((cb) => cb()),
}));

describe("useVoiceConversationLoop", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SpeechService.speakAndWait as jest.Mock).mockResolvedValue(undefined);
    (SpeechService.startListening as jest.Mock).mockResolvedValue(undefined);
  });

  it("deve iniciar o loop com fala e depois escuta", async () => {
    const onIntent = jest.fn();
    const speechText = "Olá, para onde vamos?";

    const { result } = renderHook(() => useVoiceConversationLoop({ onIntent }));

    await act(async () => {
      await result.current.startLoop(speechText);
    });

    expect(SpeechService.speakAndWait).toHaveBeenCalledWith(speechText);
    expect(SpeechService.startListening).toHaveBeenCalled();
    expect(result.current.status).toBe("listening");
  });

  it("deve processar intenção 'CONFIRM' corretamente", async () => {
    const onIntent = jest.fn();
    const { result } = renderHook(() => useVoiceConversationLoop({ onIntent }));

    // Mock startListening para chamar onResult imediatamente com uma frase de confirmação
    (SpeechService.startListening as jest.Mock).mockImplementation(({ onResult }) => {
      onResult("sim", true);
    });

    await act(async () => {
      await result.current.startLoop();
    });

    expect(onIntent).toHaveBeenCalledWith(expect.objectContaining({ type: "CONFIRM" }));
    expect(result.current.status).toBe("processing");
  });

  it("deve processar intenção 'SELECT_OPTION' corretamente", async () => {
    const onIntent = jest.fn();
    const { result } = renderHook(() => useVoiceConversationLoop({ onIntent }));

    (SpeechService.startListening as jest.Mock).mockImplementation(({ onResult }) => {
      onResult("primeira", true);
    });

    await act(async () => {
      await result.current.startLoop();
    });

    expect(onIntent).toHaveBeenCalledWith(expect.objectContaining({ 
      type: "SELECT_OPTION",
      optionIndex: 0 
    }));
  });

  it("deve repetir a fala quando receber intenção 'REPEAT'", async () => {
    const onIntent = jest.fn();
    const speechText = "Pergunta original";
    const { result } = renderHook(() => useVoiceConversationLoop({ onIntent }));

    // Simula a primeira vez: fala e ouve "repetir"
    (SpeechService.startListening as jest.Mock).mockImplementationOnce(({ onResult }) => {
      onResult("repetir", true);
    });

    await act(async () => {
      await result.current.startLoop(speechText);
    });

    // Deve ter chamado speakAndWait duas vezes (uma original, uma pela repetição)
    expect(SpeechService.speakAndWait).toHaveBeenCalledTimes(2);
    expect(SpeechService.speakAndWait).toHaveBeenLastCalledWith(speechText);
    expect(onIntent).not.toHaveBeenCalled(); // REPEAT é tratado internamente pelo hook
  });

  it("deve tratar silêncio com retry automático uma vez", async () => {
    const onIntent = jest.fn();
    const { result } = renderHook(() => useVoiceConversationLoop({ onIntent }));

    // Simula erro de silêncio na primeira tentativa
    (SpeechService.startListening as jest.Mock).mockImplementationOnce(({ onError }) => {
      onError({ error: "no-speech", isSilentError: true });
    });

    await act(async () => {
      await result.current.startLoop();
    });

    // Deve ter falado a mensagem de incentivo
    expect(SpeechService.speakAndWait).toHaveBeenCalledWith("Não consegui te ouvir. Pode repetir?");
    // Deve ter tentado ouvir de novo (1 erro + 1 sucesso no retry)
    expect(SpeechService.startListening).toHaveBeenCalledTimes(2);
  });

  it("deve mapear status corretamente no fluxo", async () => {
    const onIntent = jest.fn();
    const onStatusChange = jest.fn();
    const { result } = renderHook(() => useVoiceConversationLoop({ onIntent, onStatusChange }));

    (SpeechService.startListening as jest.Mock).mockImplementation(({ onResult }) => {
      onResult("centro", true);
    });

    await act(async () => {
      await result.current.startLoop("Oi");
    });

    expect(onStatusChange).toHaveBeenCalledWith("speaking");
    expect(onStatusChange).toHaveBeenCalledWith("listening");
    expect(onStatusChange).toHaveBeenCalledWith("processing");
  });
});
