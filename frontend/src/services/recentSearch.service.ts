import { userService, SearchHistoryItem } from "./user.service";
import { appStorage } from "./storage.service";
import { sessionService } from "./session.service";

export interface FormattedRecentSearch {
  id: string | number;
  title: string;
  subtitle: string;
  query: string;
  address?: string;
  lat?: number;
  lng?: number;
}

const RECENT_SEARCHES_STORAGE_KEY = "rotaBus_recent_searches";

export const DEFAULT_FALLBACK_SEARCHES: FormattedRecentSearch[] = [
  {
    id: "default-1",
    title: "Av. Leopoldino de Oliveira",
    subtitle: "Centro • Próximo ao Calçadão",
    query: "Av. Leopoldino de Oliveira",
  },
  {
    id: "default-2",
    title: "Praça Rui Barbosa",
    subtitle: "Centro Histórico",
    query: "Praça Rui Barbosa",
  },
  {
    id: "default-3",
    title: "Shopping Uberaba",
    subtitle: "Santa Marta",
    query: "Shopping Uberaba",
  },
];

/**
 * Converte um item de histórico ou busca em um formato padronizado com título e subtítulo.
 */
function formatHistoryItem(item: Partial<SearchHistoryItem> & { title?: string; subtitle?: string }): FormattedRecentSearch {
  const query = item.query || item.title || "Destino recente";
  let title = item.title || item.query || "Destino recente";
  let subtitle = item.subtitle || item.address || "Busca recente";

  // Se o endereço for idêntico ao título ou começar com ele, limpa detalhes repetidos
  if (item.address && item.address !== title) {
    const parts = item.address.split(",").map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      // Se a primeira parte for o nome, usa as outras partes como bairro/detalhe
      if (parts[0].toLowerCase() === title.toLowerCase()) {
        subtitle = parts.slice(1).join(" • ");
      } else {
        subtitle = item.address;
      }
    } else {
      subtitle = item.address;
    }
  }

  return {
    id: item.id ? String(item.id) : `local-${Date.now()}-${Math.random()}`,
    title,
    subtitle: subtitle || "Busca recente",
    query,
    address: item.address,
    lat: item.lat,
    lng: item.lng,
  };
}

/**
 * Obtém os locais recentes combinando o histórico da API (se logado) e o armazenamento local.
 */
async function getRecentSearches(): Promise<FormattedRecentSearch[]> {
  try {
    const token = await sessionService.getToken();
    if (token) {
      try {
        const remoteHistory = await userService.getHistory();
        if (Array.isArray(remoteHistory) && remoteHistory.length > 0) {
          const formatted = remoteHistory.map(formatHistoryItem);
          // Atualiza cache local
          await appStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(formatted.slice(0, 10)));
          return formatted;
        }
      } catch (err) {
        console.log("[recentSearchService] Falha ao buscar histórico remoto:", err);
      }
    }

    // Fallback: lê do armazenamento local
    const localRaw = await appStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
    if (localRaw) {
      const parsed = JSON.parse(localRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(formatHistoryItem);
      }
    }
  } catch (error) {
    console.log("[recentSearchService] Erro ao carregar buscas recentes:", error);
  }

  return DEFAULT_FALLBACK_SEARCHES;
}

/**
 * Salva uma nova busca recente no topo da lista local e sincroniza com o backend se autenticado.
 */
async function addRecentSearch(item: { query: string; address?: string; lat?: number; lng?: number; title?: string }): Promise<void> {
  const query = (item.query || item.title || "").trim();
  if (!query) return;

  const newItem = formatHistoryItem({
    ...item,
    query,
    title: item.title || query,
  });

  try {
    // 1. Atualiza lista local
    const localRaw = await appStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
    let list: FormattedRecentSearch[] = [];
    if (localRaw) {
      try {
        list = JSON.parse(localRaw);
        if (!Array.isArray(list)) list = [];
      } catch {
        list = [];
      }
    }

    // Remove duplicados da mesma query
    list = list.filter(i => i.query.toLowerCase() !== query.toLowerCase());
    // Adiciona o novo no início
    list.unshift(newItem);
    // Limita aos 10 mais recentes
    list = list.slice(0, 10);

    await appStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.log("[recentSearchService] Erro ao salvar localmente:", err);
  }

  // 2. Se autenticado, salva no backend de forma não bloqueante
  try {
    const token = await sessionService.getToken();
    if (token) {
      userService.addHistory({
        query,
        address: item.address,
        lat: item.lat,
        lng: item.lng,
      }).catch(err => {
        console.log("[recentSearchService] Erro ao sincronizar com backend:", err);
      });
    }
  } catch {
    // Silencioso se der erro no token
  }
}

export const recentSearchService = {
  getRecentSearches,
  addRecentSearch,
  DEFAULT_FALLBACK_SEARCHES,
};
