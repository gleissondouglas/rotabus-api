import { useState, useCallback, useRef, useEffect } from "react";
import { useFocusEffect } from "expo-router";
import { 
  speakAndWait, 
  stopSpeaking, 
  startListening, 
  stopListening, 
  isSpeechRecognitionAvailable 
} from "../services/speech.service";
import { parseVoiceIntent, type VoiceIntent } from "../utils/voiceIntentParser";
import { vibrationService } from "../services/vibration.service";

const LISTEN_AFTER_SPEECH_DELAY_MS = 250;

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Estados do Loop de Voz
 * - idle: Aguardando ação do usuário ou início automático.
 * - speaking: Assistente está falando (TTS).
 * - listening: Microfone aberto aguardando fala do usuário (STT).
 * - processing: Interpretando o comando ou enviando para o backend.
 * - error: Falha na escuta, permissão ou entendimento.
 * - stopped: Ciclo encerrado (ex: troca de tela).
 */
export type VoiceLoopStatus = 
  | "idle" 
  | "speaking" 
  | "listening" 
  | "processing" 
  | "error" 
  | "stopped";

export type VoiceRecognitionIssue =
  | { type: "EMPTY_TRANSCRIPT"; message: string }
  | { type: "UNCLEAR_TRANSCRIPT"; transcript: string; message: string }
  | { type: "SPEECH_UNAVAILABLE"; message: string }
  | { type: "SPEECH_ERROR"; message: string; error?: any };

interface VoiceConversationLoopOptions {
  /** Callback chamado quando uma intenção de voz é identificada */
  onIntent: (intent: VoiceIntent) => void | Promise<void>;
  /** Callback opcional para monitorar a mudança de status do loop */
  onStatusChange?: (status: VoiceLoopStatus) => void;
  /** Callback opcional para receber transcrições parciais/finais */
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  /** Callback opcional para explicar falhas de reconhecimento sem misturar com falhas de rede */
  onRecognitionIssue?: (issue: VoiceRecognitionIssue) => void;
}

/**
 * Hook para orquestrar o loop de conversa voice-first.
 * Gerencia o ciclo Fala -> Espera -> Escuta -> Interpretação.
 */
export function useVoiceConversationLoop({
  onIntent,
  onStatusChange,
  onTranscript,
  onRecognitionIssue,
}: VoiceConversationLoopOptions) {
  const [status, setStatus] = useState<VoiceLoopStatus>("idle");
  const isFocusedRef = useRef(true);
  const retryCountRef = useRef(0);
  const lastSpeechTextRef = useRef<string | null>(null);
  const activeRunIdRef = useRef(0);
  const onIntentRef = useRef(onIntent);
  const onStatusChangeRef = useRef(onStatusChange);
  const onTranscriptRef = useRef(onTranscript);
  const onRecognitionIssueRef = useRef(onRecognitionIssue);
  const startLoopRef = useRef<(speechText?: string) => Promise<void>>(async () => {});
  const openMicrophoneRef = useRef<(runId: number) => Promise<void>>(async () => {});
  const MAX_RETRIES = 1;

  useEffect(() => {
    onIntentRef.current = onIntent;
  }, [onIntent]);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    onRecognitionIssueRef.current = onRecognitionIssue;
  }, [onRecognitionIssue]);

  // Atualiza o estado interno e notifica o componente
  const updateStatus = useCallback((newStatus: VoiceLoopStatus) => {
    setStatus(newStatus);
    onStatusChangeRef.current?.(newStatus);
  }, []);

  const isRunActive = useCallback((runId: number) => {
    return isFocusedRef.current && activeRunIdRef.current === runId;
  }, []);

  /**
   * Para qualquer atividade de áudio (fala ou escuta).
   */
  const stopAll = useCallback(async () => {
    activeRunIdRef.current += 1;
    await stopSpeaking();
    stopListening();
  }, []);

  const handleFinalTranscript = useCallback(async (transcript: string) => {
    const finalTranscript = transcript.trim();

    if (!finalTranscript) {
      onRecognitionIssueRef.current?.({
        type: "EMPTY_TRANSCRIPT",
        message: "Não consegui entender sua fala. Toque no microfone e tente novamente.",
      });
      vibrationService.error();
      updateStatus("error");
      return;
    }

    const intent = parseVoiceIntent(finalTranscript);

    if (intent.type === "EMPTY") {
      onRecognitionIssueRef.current?.({
        type: "EMPTY_TRANSCRIPT",
        message: "Não consegui entender sua fala. Toque no microfone e tente novamente.",
      });
      vibrationService.error();
      updateStatus("error");
      return;
    }

    if (intent.type === "UNCLEAR") {
      onRecognitionIssueRef.current?.({
        type: "UNCLEAR_TRANSCRIPT",
        transcript: intent.transcript,
        message: `Entendi "${intent.transcript}", mas isso parece muito curto. Fale o nome do destino novamente ou digite o endereço.`,
      });
      vibrationService.error();
      updateStatus("error");
      return;
    }

    retryCountRef.current = 0;

    if (intent.type === "REPEAT") {
      vibrationService.light();
      await startLoopRef.current(lastSpeechTextRef.current || undefined);
      return;
    }

    updateStatus("processing");
    await onIntentRef.current(intent);
  }, [updateStatus]);

  openMicrophoneRef.current = async (runId: number) => {
    if (!isRunActive(runId)) {
      return;
    }

    if (!isSpeechRecognitionAvailable()) {
      onRecognitionIssueRef.current?.({
        type: "SPEECH_UNAVAILABLE",
        message: "O recurso de voz não está disponível neste dispositivo. Você ainda pode digitar o destino.",
      });
      updateStatus("error");
      return;
    }

    updateStatus("listening");

    await startListening({
      onStart: () => {
        if (isRunActive(runId)) {
          vibrationService.medium();
        }
      },
      onResult: (text, isFinal) => {
        if (!isRunActive(runId)) {
          return;
        }

        onTranscriptRef.current?.(text, isFinal);

        if (isFinal) {
          vibrationService.selection();
          void handleFinalTranscript(text);
        }
      },
      onError: async (err: any) => {
        if (!isRunActive(runId)) {
          return;
        }

        const isSilent = err?.isSilentError || err?.error === "no-speech";

        if (isSilent && retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current += 1;
          vibrationService.light();
          updateStatus("speaking");
          await speakAndWait("Não consegui te ouvir. Pode repetir?");

          await wait(LISTEN_AFTER_SPEECH_DELAY_MS);

          if (isRunActive(runId)) {
            await openMicrophoneRef.current(runId);
          }
          return;
        }

        retryCountRef.current = 0;
        if (isRunActive(runId)) {
          onRecognitionIssueRef.current?.({
            type: "SPEECH_ERROR",
            message: isSilent
              ? "Não consegui te ouvir. Toque no microfone e tente novamente."
              : "Não consegui entender sua fala agora. Tente falar novamente ou digite o destino.",
            error: err,
          });
          updateStatus("error");
          vibrationService.error();
        }
      },
      onEnd: () => {
        if (isRunActive(runId)) {
          setStatus((prev) => {
            if (prev === "listening") {
              onStatusChangeRef.current?.("idle");
              return "idle";
            }
            return prev;
          });
        }
      },
    });
  };

  /**
   * Inicia o ciclo de conversa.
   * Se speechText for fornecido, a assistente fala antes de abrir o microfone.
   */
  const startLoop = useCallback(async (speechText?: string) => {
    if (!isFocusedRef.current) {
      return;
    }

    if (speechText) {
      lastSpeechTextRef.current = speechText;
    }

    try {
      await stopAll();
      retryCountRef.current = 0;
      const runId = activeRunIdRef.current;

      if (speechText) {
        updateStatus("speaking");
        await speakAndWait(speechText);
        await wait(LISTEN_AFTER_SPEECH_DELAY_MS);
      }

      if (!isRunActive(runId)) {
        return;
      }

      await openMicrophoneRef.current(runId);
    } catch (err) {
      console.error("[useVoiceConversationLoop] Erro no loop:", err);
      if (isFocusedRef.current) {
        retryCountRef.current = 0;
        updateStatus("error");
      }
    }
  }, [isRunActive, stopAll, updateStatus]);

  startLoopRef.current = startLoop;

  /**
   * Cleanup e gerenciamento de foco.
   */
  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      retryCountRef.current = 0;
      
      return () => {
        isFocusedRef.current = false;
        retryCountRef.current = 0;
        void stopAll();
        updateStatus("stopped");
      };
    }, [stopAll, updateStatus])
  );

  return {
    status,
    startLoop,
    stopAll,
  };
}
