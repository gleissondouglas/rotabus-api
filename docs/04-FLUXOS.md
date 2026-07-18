# Fluxos do Sistema

Este documento descreve visualmente e logicamente as jornadas completas dos usuários dentro da arquitetura do Nuvem.

## 1. Fluxo Principal Conversacional (Voice-First Loop)

Este é o fluxo primário (Caminho Feliz). O usuário interage puramente via voz, com a interface agindo como suporte.

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Google

    User->>Frontend: Abre o App (Tela Início)
    Frontend->>Frontend: Reproduz TTS: "Para onde quer ir?"
    Frontend->>Frontend: Abre Microfone Automaticamente (STT)
    User->>Frontend: Fala (ex: "Centro")
    Frontend->>Backend: POST /resolve-destination { text: "Centro" }
    Backend->>Google: Places API: Resolve "Centro"
    Google-->>Backend: Result (Múltiplas opções)
    Backend-->>Frontend: JSON (speechText, options, STATE: WAITING_SELECTION)
    
    Frontend->>Frontend: Reproduz TTS: "Encontrei Opção 1, 2 e 3"
    Frontend->>Frontend: Abre Microfone Automaticamente
    User->>Frontend: Fala (ex: "Primeira")
    Frontend->>Backend: POST /command { command: "SELECT_OPTION", payload: 0 }
    
    Backend->>Google: Routes API (Planeja rota)
    Google-->>Backend: Rotas e Polylines
    Backend-->>Frontend: JSON (speechText, routeData, STATE: JOURNEY_DISPLAYED)
    
    Frontend->>Frontend: Reproduz TTS: "Pegue ônibus 10 em 5 min"
    Frontend->>Frontend: Renderiza Mapa e Cartão (Encerra Loop STT)
```

## 2. Máquina de Estados Finita (Diagrama de Estados do Backend)

```mermaid
stateDiagram-v2
    [*] --> IDLE
    
    IDLE --> WAITING_CONFIRMATION: DESTINATION_RESOLVED
    IDLE --> WAITING_DESTINATION_SELECTION: DESTINATION_AMBIGUOUS
    
    WAITING_CONFIRMATION --> JOURNEY_DISPLAYED: CONFIRM
    WAITING_CONFIRMATION --> IDLE: CANCEL (Volta a perguntar)
    WAITING_CONFIRMATION --> WAITING_CONFIRMATION: REPEAT
    
    WAITING_DESTINATION_SELECTION --> JOURNEY_DISPLAYED: SELECT_OPTION
    WAITING_DESTINATION_SELECTION --> IDLE: CANCEL
    WAITING_DESTINATION_SELECTION --> WAITING_DESTINATION_SELECTION: REPEAT
    
    JOURNEY_DISPLAYED --> [*]: Fim
    JOURNEY_DISPLAYED --> IDLE: CANCEL / NOVA ROTA
```

## 3. Fluxo de Falha / Fallback

Se houver ruído, falta de permissão ou preferência pessoal, o usuário migra para o Toque (Touch Fallback).

### 3.1 Exemplo: Microfone Negado ou Ambiente Ruidoso
1. O usuário nega permissão de microfone.
2. O App exibe o Fallback de texto na tela `inicio.tsx`.
3. Usuário digita "Hospital".
4. App requisita `POST /resolve-destination`.
5. Backend devolve as `options` + `speechText`.
6. App **fala** o resultado (TTS ativado) mas **não** abre o microfone, ou abre mas a transcrição falha por ruído contínuo.
7. Usuário toca na opção listada na UI.
8. Frontend processa como se fosse comando e requisita `/journeys/plan` ou `/command`.

## 4. Fluxos de Timeout e Retry de Voz

No Frontend, o hook `useVoiceConversationLoop`:
- Aguarda `X` segundos de silêncio.
- Se nenhuma voz for identificada, o loop incrementa um contador local.
- No limite (ex: 3 vezes), o sistema encerra a escuta e retorna para `idle` para evitar loops infinitos ("battery drains" ou travamento), deixando apenas a interface visual.

## 5. Cancelamentos e Retorno ao Início (Voice Command: "Não")

Caso a assistente pergunte: *"Você quis dizer Praça Rui Barbosa?"* e o usuário diga *"Não"*, o fluxo é:
1. `VoiceIntentParser` interpreta "não".
2. Transforma em comando virtual `CANCEL_AND_ASK_DESTINATION`.
3. Envia o `CANCEL` para o Backend limpar a FSM.
4. O Frontend recomeça a jornada do zero falando: *"Certo, para onde vamos?"*.
