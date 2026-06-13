# Documentação da API: Nuvem (RotaBus-API)

Este documento registra os contratos HTTP entre o frontend e o backend do Nuvem, separando os endpoints atualmente implementados das especificações planejadas para a evolução voice-first.

---

## 1. Convenções Gerais

*   **Base URL (Desenvolvimento):** `http://localhost:3000` (ou conforme configurado no `.env`).
*   **Base URL (Produção):** HTTPS obrigatório (Domínio oficial a definir).
*   **Formato de Dados:** Todas as requisições e respostas utilizam `application/json`.
*   **Autenticação:** Padrão `Bearer <JWT_TOKEN>` enviado no cabeçalho `Authorization`.
*   **Formato Padrão de Erro:**
    ```json
    {
      "error": true,
      "message": "Descrição detalhada do erro para o usuário"
    }
    ```

---

## 2. Módulo de Autenticação (`/auth`)

Endpoints responsáveis pela gestão de acesso e segurança da conta.

### POST `/auth/login`
*   **Autenticação:** Não.
*   **Proteção:** `loginLimiter` (10 tentativas / 15 min).
*   **Body:** `{ "email": "user@example.com", "password": "password123" }`
*   **Sucesso (200):** `{ "user": { "id", "name", "email", "role" }, "token": "JWT_TOKEN" }`

### POST `/auth/forgot-password`
*   **Autenticação:** Não.
*   **Body:** `{ "email": "user@example.com" }`
*   **Sucesso (200):** `{ "message": "E-mail de recuperação enviado." }`

### POST `/auth/reset-password`
*   **Autenticação:** Não.
*   **Body:** `{ "token": "string", "newPassword": "string" }`
*   **Sucesso (200):** `{ "message": "Senha alterada com sucesso." }`

---

## 3. Módulo de Usuários (`/users`)

### POST `/users`
*   **Objetivo:** Cadastro (Registro) de novos usuários.
*   **Autenticação:** Não.
*   **Body:** `{ "name", "email", "password" }`

### GET `/users/me`
*   **Autenticação:** Sim.
*   **Sucesso (200):** Retorna os dados do perfil do usuário logado.

### PATCH `/users/me`
*   **Autenticação:** Sim.
*   **Body:** `{ "name", "email" }` (campos opcionais).

### PATCH `/users/me/password`
*   **Autenticação:** Sim.
*   **Body:** `{ "currentPassword", "newPassword" }`

### DELETE `/users/me`
*   **Autenticação:** Sim.
*   **Objetivo:** Remoção da própria conta (LGPD).

### GET `/users` (Admin)
*   **Autenticação:** Sim (Admin).
*   **Objetivo:** Listagem de usuários do sistema.

### DELETE `/users/:id` (Admin)
*   **Autenticação:** Sim (Admin).
*   **Objetivo:** Remoção de usuário por ID.

---

## 4. Módulo de Jornadas (`/journeys`)

Endpoints que consomem APIs externas do Google.

### POST `/journeys/plan`
*   **Autenticação:** Sim.
*   **Proteção:** `dailyJourneyLimit`.
*   **Custo Externo:** Sim (Google Routes).
*   **Body:** 
    ```json
    {
      "origin": { "lat": number, "lng": number },
      "destination": { "text": "string", "lat?": number, "lng?": number },
      "timePreference?": { "type": "DEPARTURE|ARRIVAL", "dateTime": "ISOString" }
    }
    ```
*   **Sucesso (200):** Retorna o planejamento de rotas enriquecido.
    ```json
    {
      "speechText": "Pegue o ônibus da linha 10 às 11:30.",
      "screen": "JOURNEY_DISPLAY",
      "displayData": {
        "title": "Rota de Ônibus Encontrada",
        "subtitle": "35 min • Linha 10",
        "items": [
          { "label": "Saída de casa", "value": "11:25" },
          { "label": "Embarque no ponto", "value": "11:30" },
          { "label": "Chegada ao destino", "value": "12:00" }
        ]
      },
      "options": ["Opção 2"],
      "expectedInput": "NONE",
      "conversationState": "JOURNEY_DISPLAYED",
      "actions": ["REPEAT", "CANCEL"],
      "metadata": {
        "sessionId": "UUID-da-conversa",
        "selectedRouteIndex": 0,
        "alternativesFound": 2
      },
      // --- Campos Legados Preservados (Compatibilidade) ---
      "summary": { ... },
      "voice": { ... },
      "screen": { ... },
      "firstStopGuide": { ... },
      "alerts": [...],
      "steps": [...],
      "map": { ... },
      "alternatives": [...]
    }
    ```

### POST `/journeys/resolve-destination`
*   **Autenticação:** Sim.
*   **Custo Externo:** Sim (Google Places).
*   **Body:** 
    ```json
    {
      "text": "string", 
      "origin": { "lat": number, "lng": number },
      "sessionId?": "string"
    }
    ```
    *Nota: Também aceita o ID da sessão enviado no cabeçalho HTTP `X-Session-ID`.*
*   **Sucesso (200):** Retorna o local correspondente enriquecido.
    ```json
    {
      "speechText": "Encontrei Shopping Uberaba. É esse o lugar?",
      "screen": "DESTINATION_CONFIRMATION | SUGGESTIONS_LIST | DESTINATION_RESOLVE",
      "displayData": {
        "title": "Confirmar destino | Selecione uma opção",
        "subtitle": "shopping uberaba",
        "items": [
          { "name": "Shopping Uberaba", "address": "Av. Santa Beatriz..." }
        ]
      },
      "options": ["Shopping Uberaba"],
      "expectedInput": "VOICE_OR_TOUCH",
      "conversationState": "WAITING_CONFIRMATION | WAITING_DESTINATION_SELECTION",
      "actions": ["CONFIRM", "CANCEL", "REPEAT" | "SELECT_OPTION"],
      "metadata": {
        "sessionId": "UUID-da-conversa",
        "mode": "resolved | suggestions",
        "queryType": "specific_place"
      },
      // --- Campos Legados Preservados (Compatibilidade) ---
      "mode": "resolved | suggestions",
      "queryType": "specific_place",
      "message": "Destino encontrado.",
      "resolvedDestination": { ... },
      "candidates": [...],
      "options": [...],
      "interpretedDestination": "shopping uberaba",
      "voice": { ... }
    }
    ```

### POST `/journeys/transcribe`
*   **Autenticação:** Sim.
*   **Custo Externo:** Sim (Google Speech).
*   **Body:** `{ "audioBase64": "string" }`

### GET `/journeys/reverse-geocode`
*   **Autenticação:** Sim.
*   **Custo Externo:** Sim (Google Geocoding).
*   **Query Params:** `lat`, `lng`.

---

## 5. Tabela de Segurança e Custos

| Endpoint | JWT? | Rate Limit Global | Específico | Custo Externo |
| :--- | :---: | :---: | :---: | :---: |
| `/auth/login` | Não | Sim | `loginLimiter` | Não |
| `/users` (POST) | Não | Sim | - | Não |
| `/users/me` (PATCH/GET/DEL) | Sim | Sim | - | Não |
| `/journeys/plan` | Sim | Sim | `dailyLimit` | **Alto** |
| `/journeys/resolve-destination`| Sim | Sim | - | **Médio** |
| `/journeys/transcribe` | Sim | Sim | - | **Baixo** |
| `/journeys/reverse-geocode` | Sim | Sim | - | **Baixo** |

---

## 6. Contratos Planejados para Voice-First (Visão Futura)

Esta seção descreve a evolução planejada para os contratos de resposta, visando suportar o assistente conversacional. **Estes campos não estão necessariamente implementados no estado atual.**

### Resposta Estruturada Sugerida (JSON)
```json
{
  "speechText": "Texto que o frontend deve falar via TTS",
  "screen": "ID_DA_TELA_SUGERIDA",
  "displayData": { "dados_para_renderizar_na_tela": {} },
  "options": ["Opção 1", "Opção 2"],
  "expectedInput": "VOICE_OR_TOUCH",
  "conversationState": "ESTADO_DA_SESSAO",
  "actions": ["REPEAT", "CANCEL"]
}
```

---

## 7. Pendências de Confirmação

*   [ ] **JWT:** Qual o tempo de expiração padrão configurado?
*   [ ] **Health Check:** Confirmar se a rota `GET /` deve ser formalizada para monitoramento.
*   [ ] **Limites de Áudio:** Existe um limite de tamanho (MB) validado para o `audioBase64` no backend?
*   [ ] **Admin:** Confirmar se as rotas de listagem/deleção administrativa estão operacionais e seguras.
*   [ ] **Refatoração:** Avaliar migração futura do cadastro de `/users` (POST) para `/auth/register`.

---
*Documento gerado como parte da Fase 0 do Roadmap Técnico.*
