import { useState, useCallback, useRef, useEffect } from "react";
import { useFocusEffect } from "expo-router";
import { 
  speakAndWait, 
  stopSpeaking, 
  startListening, 
  stopListening, 
  isSpeechRecognitionAvailable 
} from "../services/speech.service";
import { parseVoiceIntent } from "../utils/voiceIntentParser";
import type { VoiceIntent } from "../utils/voiceIntentParser";
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

interface VoiceConversationLoopOptions {
  /** Callback chamado quando uma intenção de voz é identificada */
  onIntent: (intent: VoiceIntent) => void | Promise<void>;
  /** Callback opcional para monitorar a mudança de status do loop */
  onStatusChange?: (status: VoiceLoopStatus) => void;
  /** Callback opcional para receber transcrições parciais/finais */
  onTranscript?: (transcript: string, isFinal: boolean) => void;
}

/**
 * Hook para orquestrar o loop de conversa voice-first.
 * Gerencia o ciclo Fala -> Espera -> Escuta -> Interpretação.
 */
export function useVoiceConversationLoop({
  onIntent,
  onStatusChange,
  onTranscript,
}: VoiceConversationLoopOptions) {
  const [status, setStatus] = useState<VoiceLoopStatus>("idle");
  const isFocusedRef = useRef(true);
  const retryCountRef = useRef(0);
  const lastSpeechTextRef = useRef<string | null>(null);
  const activeRunIdRef = useRef(0);
  const onIntentRef = useRef(onIntent);
  const onStatusChangeRef = useRef(onStatusChange);
  const onTranscriptRef = useRef(onTranscript);
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
      updateStatus("error");
      return;
    }

    retryCountRef.current = 0;
    updateStatus("processing");
    const intent = parseVoiceIntent(finalTranscript);

    if (intent.type === "EMPTY") {
      updateStatus("error");
      return;
    }

    if (intent.type === "REPEAT") {
      vibrationService.light();
      await startLoopRef.current(lastSpeechTextRef.current || undefined);
      return;
    }

    await onIntentRef.current(intent);
  }, [updateStatus]);

  openMicrophoneRef.current = async (runId: number) => {
    if (!isRunActive(runId)) {
      return;
    }

    if (!isSpeechRecognitionAvailable()) {
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
