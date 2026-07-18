# Contratos de API (Interfaces HTTP)

Este documento concentra a documentação formal para consumo da REST API do RotaBus-API (Nuvem).
O formato central de payload das respostas conversacionais (`Server-Driven UI`) atende às especificações mais modernas do projeto.

## 1. Padrões Base

- **Base URL:** `/` (definido por `.env` em Client Apps).
- **MIME Type:** `application/json`
- **Autenticação:** Header `Authorization: Bearer <TOKEN>`

---

## 2. Payload Conversacional Estruturado (Server-Driven)

Todas as rotas de `journeys` (Destinos, Planos e Comandos) retornam o seguinte objeto decorado pelo backend, que o Frontend processa:

```json
{
  "speechText": "Encontrei dois hospitais. Qual deles você prefere?",
  "screen": "DESTINATION_CONFIRMATION",
  "displayData": {
    "title": "Escolha o Hospital",
    "items": [
      { "name": "Hospital Mário Palmério", "address": "Av. Nenê Sabino" }
    ]
  },
  "options": ["Hospital Mário Palmério"],
  "expectedInput": "VOICE_OR_TOUCH",
  "conversationState": "WAITING_CONFIRMATION",
  "actions": ["CONFIRM", "CANCEL", "REPEAT"],
  "metadata": {
    "sessionId": "4e95091a-0278-4fa3-87ca-b2fd53a8316b"
  }
}
```

---

## 3. Endpoints Principais

### POST `/auth/login`
- Autentica e devolve o JWT.
- **Request:** `{ "email", "password" }`
- **Response (200):** `{ "token", "user" }`
- **Rate Limit:** Muito estrito.

### POST `/journeys/resolve-destination`
- Entra um destino humano ("Hospital") e devolve opções locais.
- **Request:** `{ "text": "hospital", "origin": { "lat": 1, "lng": 2 }, "sessionId": "optional-uuid" }`
- **Response (200):** Payload Conversacional (`conversationState`: `WAITING_CONFIRMATION` ou `WAITING_DESTINATION_SELECTION`).

### POST `/journeys/command`
- Executa ações diretas na Máquina de Estados baseadas nas opções.
- **Request:** 
  ```json
  {
    "sessionId": "UUID",
    "command": "CONFIRM | CANCEL | SELECT_OPTION",
    "payload": { "optionIndex": 0 }
  }
  ```
- **Response (200):** Se `CONFIRM` para uma Rota, retorna o Payload Conversacional com `routeData` mapeado e tela `JOURNEY_DISPLAYED`.
- **Response (400):** Se o `sessionId` for obsoleto ou expirado no Banco.

### POST `/journeys/plan`
- Chamada legada / Fallback para plano direto de rota se as coordenadas de GPS final e inicial já estão totalmente prontas, pulando etapas conversacionais.
- **Request:** `{ "origin": { "lat", "lng" }, "destination": { "lat", "lng" } }`

### GET `/users/me`
- Obtém o perfil atual e limites da conta.
- **Response (200):** Dados do Usuário.

---

## 4. Padrão de Erro Global
Se o Middleware lançar uma Exception Zod, Error de Auth, ou FSM Inválida:
```json
{
  "error": true,
  "message": "Comando CONFIRM inválido para o estado atual: IDLE"
}
```
O Frontend não renderiza um "Popup 400" na cara do usuário; em vez disso, interpreta silenciosamente ou reproduz via Voz: *"Desculpe, ocorreu um erro e tivemos que reiniciar a conversa"*.
