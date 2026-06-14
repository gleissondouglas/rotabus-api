import { useState, useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";
import { 
  speakAndWait, 
  stopSpeaking, 
  startListening, 
  stopListening, 
  isSpeechRecognitionAvailable 
} from "../services/speech.service";
import { parseVoiceIntent, VoiceIntent } from "../utils/voiceIntentParser";
import { vibrationService } from "../services/vibration.service";

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
  const isFocusedRef = useRef(false);
  const retryCountRef = useRef(0);
  const lastSpeechTextRef = useRef<string | null>(null);
  const MAX_RETRIES = 1;

  // Atualiza o estado interno e notifica o componente
  const updateStatus = useCallback((newStatus: VoiceLoopStatus) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  }, [onStatusChange]);

  /**
   * Para qualquer atividade de áudio (fala ou escuta).
   */
  const stopAll = useCallback(async () => {
    await stopSpeaking();
    stopListening();
  }, []);

  /**
   * Inicia o ciclo de conversa.
   * Se speechText for fornecido, a assistente fala antes de abrir o microfone.
   */
  const startLoop = useCallback(async (speechText?: string) => {
    if (!isFocusedRef.current) return;

    // Salva o texto para suporte ao comando "repetir"
    if (speechText) {
      lastSpeechTextRef.current = speechText;
    }

    try {
      await stopAll();

      // 1. FALA (TTS)
      if (speechText) {
        updateStatus("speaking");
        await speakAndWait(speechText);
      }

      if (!isFocusedRef.current) return;

      // 2. VERIFICAÇÃO DE HARDWARE
      if (!isSpeechRecognitionAvailable()) {
        updateStatus("error");
        return;
      }

      // 3. ESCUTA (STT)
      updateStatus("listening");

      await startListening({
        onStart: () => {
          // Pequeno feedback tátil ao abrir o microfone
          vibrationService.medium();
        },
        onResult: (text, isFinal) => {
          onTranscript?.(text, isFinal);
          if (isFinal) {
            vibrationService.selection();
            handleFinalTranscript(text);
          }
        },
        onError: async (err: any) => {
          const isSilent = err.isSilentError || err.error === "no-speech";
          
          // Tratamento de silêncio com retry automático
          if (isSilent && isFocusedRef.current) {
            if (retryCountRef.current < MAX_RETRIES) {
              retryCountRef.current++;
              vibrationService.light();
              
              // Incentiva o usuário a falar
              updateStatus("speaking");
              await speakAndWait("Não consegui te ouvir. Pode repetir?");
              
              if (isFocusedRef.current) {
                // Tenta ouvir novamente
                startLoop();
              }
              return;
            }
          }
          
          if (isFocusedRef.current) {
            updateStatus("error");
            vibrationService.error();
          }
        },
        onEnd: () => {
          if (isFocusedRef.current) {
            // Se parou de ouvir sem disparar um resultado final ou erro, volta ao idle
            setStatus((prev) => (prev === "listening" ? "idle" : prev));
          }
        }
      });
    } catch (err) {
      console.error("[useVoiceConversationLoop] Erro no loop:", err);
      if (isFocusedRef.current) {
        updateStatus("error");
      }
    }
  }, [onTranscript, stopAll, updateStatus]);

  /**
   * Processa a transcrição final e identifica a intenção.
   */
  const handleFinalTranscript = useCallback(async (transcript: string) => {
    if (!transcript.trim()) return;
    
    updateStatus("processing");
    const intent = parseVoiceIntent(transcript);
    
    // Comando global: REPETIR
    if (intent.type === "REPEAT") {
      vibrationService.light();
      // Reinicia o loop falando o último texto
      startLoop(lastSpeechTextRef.current || undefined);
      return;
    }

    // Passa a intenção para o handler da tela
    await onIntent(intent);
  }, [onIntent, startLoop, updateStatus]);

  /**
   * Cleanup e gerenciamento de foco.
   */
  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      retryCountRef.current = 0;
      
      return () => {
        isFocusedRef.current = false;
        stopAll();
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
