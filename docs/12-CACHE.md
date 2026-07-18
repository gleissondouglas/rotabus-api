# Estratégia de Cache e Performance

Para mitigar a latência na orquestração conversacional e reduzir abruptamente custos da camada externa (Google), o projeto implementa cache hierárquico nos locais vitais.

## 1. Arquitetura do Route Cache (Em Memória)

O módulo de Journeys invoca o arquivo base `route-cache.js`.

### Princípio de Funcionamento
1. O usuário requisita a rota X -> Y.
2. O Backend encripta um hash consistente (MD5 ou equivalente simples) unindo a coordenada Origem, Destino e Hora prevista.
3. Se existir um Hit na memória RAM (`Map`), o Backend bypassa totalmente a camada do Service provider (Sem rede externa e banco) e devolve a resposta inteira (já decorada e formatada) em microssegundos (O(1)).
4. Se houver Miss, prossegue a requisição do Google Routes, preenche o Map e despacha a resposta.

### Tempo de Vida (TTL) e Invalidação
- O TTL é definido como **2 minutos**.
- Roteamento de transporte público é altamente dinâmico; atrasar mais que 2 minutos arrisca fornecer instrução de um ônibus que acabou de passar.
- Invalidação Eager: Após o expirar, a chave se deleta silenciosamente para liberar memória da RAM do Node (Garbage Collection optimization).

## 2. Desempenho e Latência Almejada

- **Resposta Direta (Cache Hit):** Tempo alvo < 50ms (sendo majoritariamente overhead do próprio framework HTTP Express/Networking).
- **Resposta Indireta (Google Hit):** Tempo alvo < 800ms. O fator rede afeta bastante as integrações geolocalizadas. O uso contido de campos (FieldMask) reduz pacotes brutos transportados.

## 3. Cache do Dispositivo (Frontend Storage)

O Frontend (React Native/Expo) tem seu próprio cache em SQLite ou AsyncStorage:
- Preferências de usuário, Auth Tokens (JWT) e flags (ex: `hasSeenOnboarding`) residem no cliente. Isso diminui a dependência de requisições redundantes de configuração de perfil a cada reload.
- **Invalidação Local:** Se a API lança 401 Unauthorized, os serviços interceptadores (Axios) destroem as flags ativas e purgam o cache do usuário voltando para tela de Login de modo suave (Graceful).
