import * as Speech from "expo-speech";
import { Audio } from "expo-av";
import { Platform, Alert } from "react-native";
import * as SecureStore from "expo-secure-store";

import { VOICE_CONFIG } from "../config/voice.config";
import { STORAGE_KEYS } from "../constants/storage";

// Importação dinâmica segura para SpeechRecognition
let SpeechRecognitionModule: any = null;
try {
  if (Platform.OS !== "web") {
    const speechLib = require("expo-speech-recognition");
    SpeechRecognitionModule = speechLib.ExpoSpeechRecognitionModule || speechLib.default || speechLib;
  }
} catch (e) {
  console.log("[SpeechService] Erro ao carregar módulo nativo:", e);
}

let sound: Audio.Sound | null = null;
let currentAbortController: AbortController | null = null;
let pendingSpeechCompletion: (() => void) | null = null;

// Armazenamento de inscrições de eventos para limpeza
let resultSubscription: any = null;
let errorSubscription: any = null;
let startSubscription: any = null;
let endSubscription: any = null;
let volumeSubscription: any = null;

/**
 * O SpeechService é o serviço responsável por toda a interação sonora do app.
 * Ele lida com o TTS (Transformar texto em fala) e o STT (Transformar fala em texto).
 */

/**
 * Fala o texto informado usando o provedor configurado.
 * Tenta usar a API do Google Cloud para uma voz mais natural, 
 * caindo para a voz local do celular em caso de falha ou falta de internet.
 */
type SpeakMode = {
  waitForCompletion: boolean;
};

function settlePendingSpeechCompletion() {
  if (!pendingSpeechCompletion) {
    return;
  }

  const resolve = pendingSpeechCompletion;
  pendingSpeechCompletion = null;
  resolve();
}

/**
 * Fala o texto e retorna assim que a reprodução for iniciada, preservando o comportamento atual.
 */
export async function speak(text: string) {
  await speakInternal(text, { waitForCompletion: false });
}

/**
 * Fala o texto e resolve apenas quando o TTS terminar ou for interrompido por stopSpeaking().
 * Esta função não inicia o microfone; ela apenas cria a base segura para o loop voice-first.
 */
export async function speakAndWait(text: string) {
  await speakInternal(text, { waitForCompletion: true });
}

async function speakInternal(text: string, mode: SpeakMode) {
  await stopSpeaking();

  currentAbortController = new AbortController();
  const signal = currentAbortController.signal;

  // Verifica se o usuário ativou a opção de "Voz Lenta" nas configurações de acessibilidade
  let isSlowVoice = false;
  try {
    const saved = Platform.OS === "web"
      ? localStorage.getItem(STORAGE_KEYS.ACCESSIBILITY_SETTINGS)
      : await SecureStore.getItemAsync(STORAGE_KEYS.ACCESSIBILITY_SETTINGS);

    if (saved) {
      const settings = JSON.parse(saved);
      isSlowVoice = !!settings.slowVoice;
    }
  } catch (e) {
    console.log("Erro ao buscar configurações para voz:", e);
  }

  // TENTA USAR GOOGLE CLOUD TTS (Voz de Alta Qualidade)
  if (VOICE_CONFIG.provider === "GOOGLE" && VOICE_CONFIG.googleApiKey) {
    try {
      console.log("Solicitando áudio para:", text.substring(0, 30) + "...");
      
      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${VOICE_CONFIG.googleApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: { text },
            voice: VOICE_CONFIG.googleVoice,
            audioConfig: { 
              audioEncoding: "MP3",
              speakingRate: isSlowVoice ? 0.75 : 1.0, // Ajusta a velocidade conforme acessibilidade
            },
          }),
          signal,
        }
      );

      if (signal.aborted) return;

      const result = await response.json();

      if (result.audioContent) {
        if (signal.aborted) return;

        // Cria o som a partir do Base64 retornado pelo Google
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: `data:audio/mp3;base64,${result.audioContent}` },
          { shouldPlay: true }
        );
        
        if (signal.aborted) {
          await newSound.unloadAsync();
          return;
        }

        sound = newSound;
        
        // Limpa o objeto de som da memória quando ele terminar de tocar
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            sound?.unloadAsync();
            if (sound === newSound) sound = null;
            settlePendingSpeechCompletion();
          }
        });

        if (mode.waitForCompletion) {
          await new Promise<void>((resolve) => {
            pendingSpeechCompletion = resolve;
          });
        }
        
        return;
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("Fala cancelada (AbortError)");
        return;
      }
      console.log("Erro na voz de IA, usando voz local de segurança:", error);
    }
  }

  // FALLBACK: VOZ LOCAL (Nativa do iOS/Android)
  // Usada se a chave do Google não existir ou se a internet falhar.
  if (mode.waitForCompletion) {
    await new Promise<void>((resolve) => {
      pendingSpeechCompletion = resolve;

      Speech.speak(text, {
        ...VOICE_CONFIG.localVoice,
        rate: isSlowVoice ? 0.9 : VOICE_CONFIG.localVoice.rate,
        onStart: () => console.log("Iniciando voz local..."),
        onDone: settlePendingSpeechCompletion,
        onStopped: settlePendingSpeechCompletion,
        onError: settlePendingSpeechCompletion,
      });
    });
    return;
  }

  Speech.speak(text, {
    ...VOICE_CONFIG.localVoice,
    rate: isSlowVoice ? 0.9 : VOICE_CONFIG.localVoice.rate,
    onStart: () => console.log("Iniciando voz local..."),
  });
}

/**
 * Interrompe qualquer som ou fala que esteja tocando no momento.
 */
export async function stopSpeaking() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }

  settlePendingSpeechCompletion();
  Speech.stop(); // Para a voz nativa

  if (sound) {
    try {
      const status = await sound.getStatusAsync();
      if (status.isLoaded) {
        await sound.stopAsync();
        await sound.unloadAsync();
      }
    } catch (e) {
      // Ignora erro ao tentar parar som já descarregado
    } finally {
      sound = null;
    }
  }
}

/**
 * Inicia o Reconhecimento de Fala (STT - Speech-to-Text).
 * Utiliza o microfone para capturar o que o usuário diz.
 */
export async function startListening(options: {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (error: any) => void;
  onStart?: () => void;
  onEnd?: () => void;
}) {
  console.log("[SpeechService] Iniciando escuta (lang: pt-BR)...");

  if (!SpeechRecognitionModule) {
    console.warn("[SpeechService] SpeechRecognitionModule indisponível.");
    Alert.alert(
      "Não consegui ouvir agora",
      "O recurso de voz não está disponível neste dispositivo."
    );
    options.onError(new Error("Module not available"));
    return;
  }

  try {
    // 1. Reset da sessão de áudio anterior
    await stopSpeaking();
    
    // Pequeno delay para garantir que o hardware de áudio seja liberado (essencial para iOS Simulator)
    await new Promise(resolve => setTimeout(resolve, 500));

    // 2. Configuração agressiva da sessão de áudio para iOS
    if (Platform.OS === "ios") {
      // Usa métodos nativos da biblioteca de fala para garantir compatibilidade
      try {
        SpeechRecognitionModule.setCategoryIOS({
          category: "playAndRecord",
          categoryOptions: ["defaultToSpeaker", "allowBluetooth", "mixWithOthers"],
          mode: "measurement",
        });
        SpeechRecognitionModule.setAudioSessionActiveIOS(true);
      } catch (err) {
        console.log("[SpeechService] Erro ao setar categoria nativa iOS:", err);
      }
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
        interruptionModeIOS: 1, // DoNotMix
      });
    } else {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });
    }

    const permission = await SpeechRecognitionModule.requestPermissionsAsync();
    console.log("[SpeechService] Permissão:", permission.status);

    if (!permission.granted) {
      Alert.alert(
        "Sem permissão",
        "Você precisa permitir o uso do microfone para usar o comando de voz."
      );
      options.onError(new Error("Permission denied"));
      return;
    }

    // Limpa inscrições anteriores para evitar duplicidade
    cleanupListeners();

    // REGISTRO CORRETO DOS LISTENERS NATIVOS (API REAL DA LIB)
    resultSubscription = SpeechRecognitionModule.addListener("result", (event: any) => {
      // Tenta obter a transcrição de múltiplos formatos possíveis para maior compatibilidade
      const transcript = event.results?.[0]?.transcript || event.transcript || "";
      const isFinal = event.isFinal;
      
      if (transcript) {
        if (process.env.NODE_ENV !== "production") {
          console.log(`[SpeechService] onResult: ${isFinal ? "FINAL" : "PARCIAL"} | Texto: "${transcript}"`);
        }
        options.onResult(transcript, isFinal);
      }
    });

    errorSubscription = SpeechRecognitionModule.addListener("error", (event: any) => {
      if (event?.error === "no-speech") {
        console.log("[SpeechService] Silêncio detectado (no-speech).");
        options.onError({
          ...event,
          error: "no-speech",
          message: "Não ouvi seu destino. Tente falar novamente.",
          isSilentError: true,
        });
      } else {
        console.warn("[SpeechService] Erro de reconhecimento:", event?.error, event?.message);
        options.onError(event);
      }
      cleanupListeners();
    });

    startSubscription = SpeechRecognitionModule.addListener("start", () => {
      console.log("[SpeechService] onStart recebido");
      if (options.onStart) options.onStart();
    });

    endSubscription = SpeechRecognitionModule.addListener("end", () => {
      console.log("[SpeechService] onEnd recebido");
      if (options.onEnd) options.onEnd();
      cleanupListeners();
    });

    // Monitoramento de volume para diagnóstico (ajuda a saber se o mic está captando algo)
    volumeSubscription = SpeechRecognitionModule.addListener("volumechange", (event: any) => {
      if (event.value > -1 && process.env.NODE_ENV !== "production") {
        // Log discreto apenas se houver ruído
        // console.log("[SpeechService] Volume detectado:", event.value);
      }
    });

    // Inicia o motor nativo com as opções de idioma e resultados parciais
    SpeechRecognitionModule.start({
      lang: "pt-BR",
      interimResults: true,
      continuous: Platform.OS === 'android', // No iOS, continuous pode causar timeouts rápidos no simulador
      volumeChangeEventOptions: { enabled: true, intervalMillis: 300 },
      contextualStrings: [
        "Praça Rui Barbosa",
        "Hospital Mário Palmério",
        "Terminal Univerde",
        "Terminal Gameleiras",
        "Terminal Beija-Flor",
        "UFTM",
        "Shopping Uberaba"
      ]
    });
  } catch (error) {
    console.error("[SpeechService] Falha ao iniciar reconhecimento:", error);
    options.onError(error);
  }
}

/**
 * Interrompe o reconhecimento de fala.
 */
export function stopListening() {
  if (SpeechRecognitionModule) {
    try {
      console.log("[SpeechService] Chamando stop nativo...");
      SpeechRecognitionModule.stop();
      if (Platform.OS === "ios") {
        SpeechRecognitionModule.setAudioSessionActiveIOS(false);
      }
    } catch (e) {
      console.log("[SpeechService] Erro ao parar escuta:", e);
    }
  }
}

/**
 * Remove todos os listeners ativos.
 */
function cleanupListeners() {
  resultSubscription?.remove();
  errorSubscription?.remove();
  startSubscription?.remove();
  endSubscription?.remove();
  volumeSubscription?.remove();
  
  resultSubscription = null;
  errorSubscription = null;
  startSubscription = null;
  endSubscription = null;
  volumeSubscription = null;
}

/**
 * Verifica se o reconhecimento está disponível.
 */
export function isSpeechRecognitionAvailable() {
  return !!SpeechRecognitionModule;
}
