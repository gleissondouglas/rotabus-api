import { API_BASE_URL } from "../config/api.config";
import { 
  JourneyResponse, 
  PlanJourneyRequest, 
  ResolveDestinationRequest, 
  ResolveDestinationResponse,
  ConversationalCommandRequest,
  ConversationalCommandResponse,
  ParseTimeRequest,
  ParseTimeResponse,
} from "../types/journey.types";
import { sessionService } from "./session.service";
import { request } from "../utils/api";
import { withRetry } from "../utils/network";
import { cache } from "../utils/cache";

const DEFAULT_TIMEOUT = 15000; // 15 segundos para rotas
const ROUTE_CACHE_TTL = 1000 * 30; // 30 segundos (evita cliques duplos, mas mantém dados frescos)
const DESTINATION_CACHE_TTL = 1000 * 60 * 10; // 10 minutos para buscas de destino

/**
 * O JourneyService gerencia a comunicação com o backend para tudo que envolve
 * rotas de ônibus, geocodificação e planejamento de viagens.
 */

/**
 * Solicita ao backend um plano de viagem detalhado.
 * O backend consulta as APIs do Google Maps e retorna os passos (caminhada e ônibus).
 */
async function planJourney(data: PlanJourneyRequest): Promise<JourneyResponse> {
  const token = await sessionService.getToken();
  const sessionId = sessionService.getSessionId();
  
  const requestBody = {
    ...data,
    ...(sessionId ? { sessionId } : {}),
  };

  // Tenta recuperar do cache para evitar cobranças duplicadas na API do Google
  const cacheKey = `plan:${JSON.stringify(data.origin)}-${JSON.stringify(data.destination)}-${sessionId || ""}`;
  const cached = cache.get<JourneyResponse>(cacheKey, ROUTE_CACHE_TTL);
  
  if (cached) {
    console.log("[JourneyService] Retornando rota do cache.");
    return cached;
  }

  try {
    const result = await withRetry(async () => {
      return await request<JourneyResponse>(`${API_BASE_URL}/journeys/plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
        timeout: DEFAULT_TIMEOUT,
      });
    });

    // Salva o sessionId retornado pelo backend
    if (result.metadata?.sessionId) {
      sessionService.setSessionId(result.metadata.sessionId);
    }

    // Salva no cache se a requisição for bem-sucedida
    cache.set(cacheKey, result);
    return result;
  } catch (error: any) {
    if (error?.message && (
      error.message.includes("Sessão conversacional não encontrada") ||
      error.message.includes("sessão expirada") ||
      error.message.includes("Sessão expirada") ||
      error.message.includes("não encontrada ou expirada")
    )) {
      sessionService.clearSessionId();
    }
    throw error;
  }
}

/**
 * Transforma um texto falado (ex: "me leve ao centro") em uma localização geográfica.
 * O backend interpreta o texto e sugere destinos prováveis.
 */
async function resolveDestination(data: ResolveDestinationRequest): Promise<ResolveDestinationResponse> {
  const token = await sessionService.getToken();
  const sessionId = sessionService.getSessionId();

  const requestBody = {
    ...data,
    ...(sessionId ? { sessionId } : {}),
  };

  const cacheKey = `resolve:${data.text}:${data.origin.lat},${data.origin.lng}-${sessionId || ""}`;
  const cached = cache.get<ResolveDestinationResponse>(cacheKey, DESTINATION_CACHE_TTL);

  if (cached) {
    console.log("[JourneyService] Retornando destino do cache.");
    return cached;
  }

  try {
    const result = await withRetry(async () => {
      return await request<ResolveDestinationResponse>(`${API_BASE_URL}/journeys/resolve-destination`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
        timeout: DEFAULT_TIMEOUT,
      });
    });

    // Salva o sessionId retornado pelo backend
    if (result.metadata?.sessionId) {
      sessionService.setSessionId(result.metadata.sessionId);
    }

    cache.set(cacheKey, result);
    return result;
  } catch (error: any) {
    if (error?.message && (
      error.message.includes("Sessão conversacional não encontrada") ||
      error.message.includes("sessão expirada") ||
      error.message.includes("Sessão expirada") ||
      error.message.includes("não encontrada ou expirada")
    )) {
      sessionService.clearSessionId();
    }
    throw error;
  }
}

/**
 * Envia um comando conversacional (CONFIRM, CANCEL, REPEAT, SELECT_OPTION) para o backend.
 */
async function executeCommand(data: ConversationalCommandRequest): Promise<ConversationalCommandResponse> {
  const token = await sessionService.getToken();

  try {
    const result = await withRetry(async () => {
      return await request<ConversationalCommandResponse>(`${API_BASE_URL}/journeys/command`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
        timeout: DEFAULT_TIMEOUT,
      });
    });

    // Trata atualização de sessão baseada no retorno
    if (result.metadata?.sessionId) {
      sessionService.setSessionId(result.metadata.sessionId);
    } else if (data.command === "CANCEL" || result.conversationState === "IDLE") {
      sessionService.clearSessionId();
    }

    return result;
  } catch (error: any) {
    if (error?.message && (
      error.message.includes("Sessão conversacional não encontrada") ||
      error.message.includes("sessão expirada") ||
      error.message.includes("Sessão expirada") ||
      error.message.includes("não encontrada ou expirada")
    )) {
      sessionService.clearSessionId();
    }
    throw error;
  }
}

/**
 * Interpreta APENAS a intenção de horário de uma frase falada.
 * Usado na tela de escolha de horário quando o destino já está definido.
 * Não usa cache pois horários são sempre relativos ao momento atual.
 */
async function parseTimeIntent(data: ParseTimeRequest): Promise<ParseTimeResponse> {
  const token = await sessionService.getToken();

  // Sem cache - horário é sempre relativo ao momento atual
  return await request<ParseTimeResponse>(`${API_BASE_URL}/journeys/parse-time`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
    timeout: 10000,
  });
}

export const journeyService = {
  planJourney,
  resolveDestination,
  executeCommand,
  parseTimeIntent,
};
