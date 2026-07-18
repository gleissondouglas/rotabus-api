# Backend (Node.js & Express)

A API do projeto Nuvem é estruturada sobre Node.js e utiliza o framework Express. Ela é robusta, projetada com separação rigorosa de camadas.

## 1. Pilha Tecnológica

- **Core:** Node.js, Express.
- **ORM:** Prisma Client e `@prisma/adapter-pg`.
- **Validação:** Zod (Middlewares estritos de tipos e dados).
- **Segurança:** Helmet, Express Rate Limit, bcrypt, JSONWebToken (JWT).
- **Logger e Monitoramento:** Sentry Integration.

## 2. Padrão de Camadas (The Layered Pattern)

Cada módulo (`auth`, `users`, `journeys`) obedece a um fluxo unidirecional:

### Router (`*.routes.js`)
Expõe Endpoints e anexa Middlewares (Validação, Autorização). Exemplo:
```javascript
router.post('/plan', 
    authenticateMiddleware, 
    dailyLimitMiddleware, 
    validate(planJourneySchema), 
    journeysController.plan
);
```

### Validator (`*.validator.js`)
Define schemas do Zod. O middleware genérico `validate.middleware.js` consome o Zod Schema e aplica nas requisições. Retorna HTTP 400 antes de poluir a aplicação se falhar.

### Controller (`*.controller.js`)
Lida exclusivamente com requisições HTTP (`req`, `res`, `next`). 
Passa um objeto contendo os parâmetros limpos para o Serviço (sem nunca injetar `req` ou `res` na camada de serviço). Recebe a resposta e empacota no `res.json()`. Catch injeta erros no `next(error)`.

### Service (`*.service.js`)
Camada isolada de orquestração. Não sabe o que é HTTP. Contém os casos de uso. Delega ações aos `providers` e coordena a FSM via `Dialog Manager`.

### Providers (`/providers`)
Pontes padronizadas para o mundo exterior (APIs). Escondem como a requisição `axios` está sendo feita e como formatam tokens.
- `googleRoutes.provider.js`
- `googlePlaces.provider.js`
- `speech.provider.js`

### Repositories (`*.repository.js`)
Pontes exclusivas para o Prisma Client. Nenhuma outra classe/arquivo deve importar ou utilizar PrismaClient diretamente, conforme estipulado nas ADRs.

## 3. Gestão de Erros Globais

Centralizado no `error.middleware.js`.
Seja em um Controller ou num Service profundo, basta fazer `throw new Error('Mensagem')` (ou criar erros customizados como `SessionExpiredError`).
O middleware intercepta, categoriza o HTTP Code (Ex: `ValidationError` vira 400) e oculta stack traces da resposta de produção, enquanto loga (Sentry/Console) os detalhes internos.

## 4. O Sistema de Sessão (Session Manager)

Como HTTP é stateless, a conversa necessita de memória.
O `SessionManager` guarda o `ConversationState` atual do usuário.
Pode operar via:
1. `Map` (Em Memória - usado em Testes Locais/Smoke)
2. `PostgreSQL` (Produção, com suporte a multinstâncias).

O Backend retorna no payload sempre um `sessionId` que o frontend deve reenviar seja por Header `X-Session-ID` ou Payload JSON.

## 5. Decorators e Mappers

O componente `conversational.mapper.js` atua na fronteira de saída. O Serviço pode calcular uma rota pura, enquanto o mapper pega essa rota e "decora" o JSON com campos Voice-First:
`speechText`, `options`, `expectedInput`, `actions`. 
Isso permite que a lógica de "calcular transporte" fique separada da "lógica de apresentação falada".

## 6. Trabalhos Assíncronos

Jobs leves como deleção de conversas expiradas (TTL) são configurados via scripts (`scripts/cleanup-expired-conversation-sessions.js`), normalmente invocados via cron no servidor, ou em hooks programados no sistema, mantendo a tabela leve.
