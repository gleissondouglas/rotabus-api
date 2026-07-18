# Integrações (Google APIs)

O coração geoespacial do Nuvem depende das APIs da Google Cloud Platform (GCP). Como essas integrações são vitais e envolvem cobrança em dólar, o mapeamento e blindagem dessas APIs é prioridade extrema.

## 1. Provider de Rotas (`googleRoutes.provider.js`)

**API Utilizada:** Google Routes API (Versão superior ao Directions).
- **Objetivo:** Computar o roteamento de trânsito público (Ônibus) misturado com percursos a pé.
- **Entrada Principal:** Lat/Lng ou ID do Place, juntamente com preferência de tempo (`DEPARTURE` ou `ARRIVAL`).
- **Comportamento Mapeado:** O provider invoca o Google e extrai apenas o trajeto de maior relevância, varrendo as seções de `steps` e `polylines` (coordenadas compactadas da linha traçada no mapa) para desenhar na tela (SDUI - Map Rendering).

## 2. Provider de Locais (`googlePlaces.provider.js`)

**API Utilizada:** Google Places API (New Text Search).
- **Objetivo:** Quando o `LocalIntelligence` não acha um mapeamento fixo, o texto livre do usuário cai nesta API.
- **Tática de Bias:** É passado o `locationBias` para o Backend baseado nas coordenadas GPS atuais do usuário, forçando o Google a retornar resultados mais próximos primeiro (evitando que "Hospital de Clínicas" resolva para outra cidade).
- **Tratamento de Ambiguidade:** Se a pontuação (relevância) não for forte o suficiente em relação aos demais ou retornarem muitas opções viáveis, o backend despacha um estado de *Seleção Múltipla* (`WAITING_DESTINATION_SELECTION`) em vez de autoconfirmar o trajeto errado.

## 3. Mapas Estáticos / Geocoding (`geocoding.provider.js`)

- **Objetivo (Geocoding Reverse):** Transformar um Lat/Lng de GPS bruto que vem do frontend em um endereço humanamente legível (Ex: "Avenida X, perto de Y") que o TTS pode vocalizar para confirmar localização.

## 4. Estratégias e Blindagens de Custo

1. **Daily Journey Limit (API Usage Table):** 
   Nenhuma conta tem permissão ilimitada para forçar o sistema. O Middleware `dailyLimitMiddleware` lê do PostgreSQL quantas requisições de Rota o usuário fez hoje. Ao bater no limite, o request para o Google é abortado com `429 Too Many Requests`.
2. **In Memory Caching (Cache de Rotas Rápido):**
   Requisições de rota (exatamente mesma origem e destino, em pouco tempo) são salvas em um objeto em memória LRU Cache com TTL curto (ex: 2 min). Se o app repete a mesma requisição via duplo clique/timeout, o Google Routes não é invocado novamente, retornando o objeto da RAM.
3. **Restrição de Máscara (Field Masking):**
   Nas APIs do GCP (Routes e Places), o Headers exige uma lista estrita de quais campos queremos do JSON de volta (`X-Goog-FieldMask`). Requisitar "*" no Google causa a cobrança do SKU mais caro. Nós solicitamos apenas campos minúsculos necessários.
