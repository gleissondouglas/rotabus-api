/**
 * Utilitário de cache em memória para persistir respostas de API durante a sessão.
 * Ajuda a economizar dados e melhorar a performance em buscas repetidas.
 */

interface CacheItem<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheItem<any>>();

export const cache = {
  /**
   * Salva um item no cache com um tempo de vida (TTL) em milissegundos.
   */
  set<T>(key: string, data: T): void {
    memoryCache.set(key, {
      data,
      timestamp: Date.now(),
    });
  },

  /**
   * Recupera um item do cache. Se expirado ou não encontrado, retorna null.
   */
  get<T>(key: string, ttlMs: number): T | null {
    const item = memoryCache.get(key);
    
    if (!item) return null;

    const isExpired = Date.now() - item.timestamp > ttlMs;

    if (isExpired) {
      memoryCache.delete(key);
      return null;
    }

    return item.data as T;
  },

  /**
   * Limpa todo o cache do app.
   */
  clear(): void {
    memoryCache.clear();
  }
};
