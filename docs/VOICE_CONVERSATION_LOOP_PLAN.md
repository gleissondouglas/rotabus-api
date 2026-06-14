# Plano do Loop Conversacional por Voz: Nuvem

Este documento define a arquitetura planejada para o futuro fluxo de conversa por voz do Nuvem. Ele descreve o comportamento esperado, os componentes de frontend necessários, o parser determinístico inicial e os riscos técnicos conhecidos. Nenhuma implementação de código é definida aqui como concluída.

---

## 1. Objetivo

O Nuvem deve evoluir para uma experiência **voice-first**, mantendo a interface visual e os botões como apoio e fallback. A interação principal será guiada por fala: a assistente fala com o usuário, aguarda a fala terminar completamente e só então ativa o microfone.

O usuário poderá responder por voz ou tocar nos botões da tela. Essa decisão preserva o princípio de produto já adotado no projeto: **voice-first, não voice-only**.

Regras centrais do loop:

* A assistente nunca deve ligar o microfone enquanto ainda está falando.
* A fala da assistente deve ser interrompida ao trocar de tela.
* O microfone deve ser desligado ao trocar de tela, cancelar ou encerrar o ciclo.
* O app deve tratar permissão de microfone com fallback visual.
* O loop deve evitar repetição infinita entre fala e escuta.

---

## 2. Fluxo Desejado

### 2.1 Busca de destino

1. Após login ou ao entrar na tela inicial, a assistente fala:
   > "Olá, [nome]. Para onde você gostaria de ir hoje?"
2. Quando a fala termina, o app ativa o microfone automaticamente.
3. O usuário fala um destino, por exemplo:
   > "Centro"
4. O app transcreve a fala e envia o texto para o backend via `/journeys/resolve-destination`.
5. O backend resolve o destino e retorna o payload conversacional enriquecido.

### 2.2 Confirmação de destino único

1. Se o backend resolver um destino único, a assistente fala:
   > "Encontrei Praça Rui Barbosa. É esse destino mesmo?"
2. Quando a fala termina, o app ativa o microfone novamente.
3. Se o usuário responder "sim", "isso", "correto" ou equivalente, o app envia `CONFIRM` para `/journeys/command`.
4. Se o usuário responder "não", "errado", "outro destino" ou equivalente, o app cancela a sessão atual e pergunta:
   > "Certo. Para onde você quer ir?"
5. A resposta seguinte passa a ser tratada como novo texto de destino.

### 2.3 Seleção entre várias opções

1. Se o backend retornar várias opções, a assistente lê as opções principais.
2. O microfone é ativado após a leitura.
3. Respostas como "primeira", "segunda" e "terceira" são convertidas em `SELECT_OPTION` com o índice correspondente.
4. A seleção por toque continua disponível na lista visual.

### 2.4 Comandos globais de voz

Durante telas conversacionais que aceitam entrada, o app deve interpretar:

* "repetir", "fala de novo" ou "não entendi" como `REPEAT`;
* "cancelar" ou "voltar ao início" como `CANCEL`;
* botões visuais como fallback equivalente aos comandos de voz.

---

## 3. Arquitetura Proposta

### 3.1 `frontend/src/services/speech.service.ts`

O serviço de fala deve expor uma API aguardável para TTS:

* `speakAndWait(text)`: fala o texto e resolve somente quando a fala terminar;
* mantém compatibilidade com `speak(text)` para usos existentes;
* deve funcionar tanto com Google TTS quanto com fallback local do dispositivo;
* deve cancelar corretamente a fala pendente quando `stopSpeaking()` for chamado;
* deve evitar que `startListening()` interrompa uma fala ainda em andamento.

Essa API é o pré-requisito técnico mais importante do loop. Sem ela, o app dependeria de delays fixos para abrir o microfone, o que aumenta o risco de captar a própria fala da assistente.

### 3.2 `frontend/src/utils/voiceIntentParser.ts`

Novo utilitário responsável por transformar transcrições simples em intenções determinísticas.

Responsabilidades:

* normalizar texto para lowercase;
* remover acentos e pontuação;
* identificar confirmações, rejeições, repetição, cancelamento e seleção ordinal;
* retornar `DESTINATION_TEXT` quando a fala não for um comando conhecido.

O parser não deve usar LLM nesta fase.

### 3.3 `frontend/src/hooks/useVoiceConversationLoop.ts`

Novo hook para orquestrar fala, escuta e dispatch de ações.

Responsabilidades:

* falar uma mensagem via `speakAndWait`;
* ativar o microfone apenas após o fim real da fala;
* coletar transcrição final;
* chamar o parser determinístico;
* despachar a ação resultante para handlers da tela;
* cancelar ciclos antigos ao perder foco ou trocar de tela;
* limitar tentativas após silêncio para evitar loop infinito.

O hook deve ser uma FSM local do frontend. Ele não substitui a FSM do backend. A FSM local controla áudio e interação; a FSM do backend continua sendo a autoridade para estado conversacional e comandos.

### 3.4 Integração futura em telas

#### `frontend/app/inicio.tsx`

Integração inicial recomendada:

* falar a saudação;
* abrir microfone após o TTS;
* tratar texto livre como destino;
* manter botão de microfone e digitação.

#### `frontend/app/confirmar-destino.tsx`

Integração principal do fluxo multi-turno:

* falar `speechText` recebido do backend;
* abrir microfone após a fala;
* mapear "sim" para o mesmo fluxo do botão de confirmar;
* mapear "não" para cancelamento e nova pergunta de destino;
* mapear "primeira", "segunda", "terceira" para seleção de opção;
* mapear "repetir" para o mesmo fluxo do botão de ouvir destino.

#### `frontend/app/melhor-rota.tsx`

Integração posterior:

* manter "Ouvir resumo";
* aceitar comandos simples como `REPEAT` e `CANCEL`;
* não abrir microfone automaticamente quando `expectedInput` for `NONE`.

### 3.5 Backend

O backend deve ser pouco alterado ou não alterado inicialmente.

O contrato existente já fornece:

* `speechText`;
* `screen`;
* `displayData`;
* `options`;
* `expectedInput`;
* `conversationState`;
* `actions`;
* `metadata.sessionId`.

Possível ajuste pequeno:

* incluir `REPEAT` em `actions` também quando o estado for `WAITING_DESTINATION_SELECTION`, caso o produto queira permitir repetição explícita durante listas de opções.

O comando "não" ainda não possui comando próprio no backend. Na primeira versão, a recomendação é tratar "não" no frontend como cancelamento da sessão atual e reinício da pergunta de destino.

---

## 4. Estados Locais do Frontend

O loop de voz deve usar estados locais explícitos:

| Estado | Significado |
| :--- | :--- |
| `idle` | Nenhum ciclo automático em andamento. |
| `speaking` | A assistente está falando via TTS. |
| `waiting_to_listen` | Pequeno intervalo técnico após fim do TTS antes de abrir o microfone. |
| `listening` | Microfone aberto e capturando fala do usuário. |
| `processing_transcript` | Transcrição final sendo normalizada e interpretada. |
| `dispatching_command` | App chamando `resolveDestination` ou `/journeys/command`. |
| `error` | Erro de permissão, silêncio, STT ou rede. |
| `stopped` | Ciclo cancelado por troca de tela, cancelamento manual ou cleanup. |

Esses estados devem ficar no frontend e não devem substituir `conversationState` retornado pelo backend.

---

## 5. Parser Determinístico Inicial

O parser inicial deve ser simples, previsível e testável. A normalização mínima deve considerar lowercase, remoção de acentos e remoção de pontuação.

| Fala do usuário | Intenção |
| :--- | :--- |
| `sim`, `isso`, `correto`, `pode ser`, `é esse` | `CONFIRM` |
| `não`, `errado`, `outro destino`, `mudar` | cancelar e perguntar destino novamente |
| `repetir`, `fala de novo`, `não entendi` | `REPEAT` |
| `primeira`, `opção um`, `número um` | `SELECT_OPTION` com `optionIndex: 0` |
| `segunda`, `opção dois`, `número dois` | `SELECT_OPTION` com `optionIndex: 1` |
| `terceira`, `opção três`, `número três` | `SELECT_OPTION` com `optionIndex: 2` |
| qualquer outro texto | `DESTINATION_TEXT` |

Exemplo conceitual de retorno:

```ts
type VoiceIntent =
  | { type: "CONFIRM" }
  | { type: "CANCEL_AND_ASK_DESTINATION" }
  | { type: "REPEAT" }
  | { type: "CANCEL" }
  | { type: "SELECT_OPTION"; optionIndex: number }
  | { type: "DESTINATION_TEXT"; text: string };
```

---

## 6. Riscos Técnicos

* **Microfone captar a fala da assistente:** risco alto se o microfone abrir antes do fim real do TTS.
* **TTS não avisar corretamente quando terminou:** Google TTS e voz local têm APIs diferentes; `speakAndWait` deve unificar esse comportamento.
* **Loop infinito de fala/microfone:** silêncio ou erro recorrente não pode gerar repetição infinita. Deve existir limite de tentativas.
* **Permissão de microfone:** usuário pode negar permissão; o app deve continuar funcionando por toque.
* **Sessão expirada:** `/journeys/command` pode retornar sessão não encontrada ou expirada; o app deve limpar `sessionId` e voltar para `/inicio`.
* **Usuário falar algo fora do esperado:** parser deve cair para `DESTINATION_TEXT` ou pedir repetição de forma controlada.
* **"não" ainda não ter comando backend próprio:** a primeira versão deve tratar como cancelamento e nova pergunta. Um comando futuro `REJECT` pode ser avaliado depois.
* **Ambientes ruidosos:** STT pode retornar texto parcial ou incorreto. Botões devem permanecer disponíveis.
* **Troca de tela durante fala ou escuta:** cleanup deve parar TTS e STT para evitar efeitos colaterais na próxima tela.

---

## 7. Plano de Implementação Futuro

### `feat/frontend-voice-loop-foundation`

Base técnica sem integração profunda de tela:

* implementar `speakAndWait`;
* criar `voiceIntentParser.ts`;
* criar `useVoiceConversationLoop.ts`;
* adicionar testes unitários da fundação.

### `feat/frontend-voice-loop-inicio-confirmacao`

Primeira integração funcional:

* integrar saudação e escuta automática em `inicio.tsx`;
* integrar confirmação por voz em `confirmar-destino.tsx`;
* mapear `CONFIRM`, `REPEAT`, `CANCEL_AND_ASK_DESTINATION` e texto livre;
* manter todos os botões existentes.

### `feat/frontend-voice-loop-opcoes`

Expansão para listas de opções:

* mapear "primeira", "segunda" e "terceira";
* executar `SELECT_OPTION` com índice correto;
* validar fallback por toque;
* ajustar leitura das opções principais.

### `feat/frontend-voice-loop-melhor-rota`

Expansão controlada para rota encontrada:

* aceitar `REPEAT` e `CANCEL`;
* não iniciar escuta automática quando `expectedInput` for `NONE`;
* preservar `Ouvir resumo` e `Iniciar navegação`.

### `docs/atualiza-voice-loop-final`

Finalização documental:

* atualizar `VOICE_ASSISTANT_ARCHITECTURE.md`;
* atualizar `CONVERSATIONAL_E2E_MANUAL_TEST.md`;
* registrar decisões arquiteturais finais em `DECISIONS.md`, se necessário.

---

## 8. Testes Planejados

### Unitários

* `frontend/src/utils/voiceIntentParser.spec.ts`
  * confirmações simples;
  * rejeições;
  * repetição;
  * seleção ordinal com acentos e sem acentos;
  * texto livre como destino.

* `frontend/src/services/speech.service.spec.ts`
  * `speakAndWait` resolve quando TTS local termina;
  * `speakAndWait` resolve quando playback do Google TTS termina;
  * `stopSpeaking` cancela uma fala pendente;
  * `startListening` não deve ser acionado durante fala ativa no fluxo orquestrado.

* `frontend/src/hooks/useVoiceConversationLoop.spec.ts`
  * fala antes de ouvir;
  * abre microfone após fim do TTS;
  * cancela ciclo ao perder foco;
  * limita tentativas em silêncio;
  * despacha `CONFIRM`, `REPEAT`, `SELECT_OPTION` e `DESTINATION_TEXT`.

### Manuais no simulador

* Entrar após login e ouvir a saudação.
* Verificar se o microfone abre somente após a fala terminar.
* Falar "Centro" e confirmar que o backend resolve o destino.
* Responder "sim" na confirmação.
* Responder "não" e verificar nova pergunta de destino.
* Em sugestões, responder "primeira", "segunda" e "terceira".
* Dizer "repetir" e verificar `REPEAT`.
* Dizer "cancelar" e verificar retorno ao início.
* Negar permissão de microfone e confirmar fallback por toque.
* Trocar de tela durante fala e confirmar que TTS e STT param corretamente.

---

## 9. Critérios de Aceitação

* O app nunca ativa o microfone durante a fala da assistente.
* O usuário consegue completar o fluxo principal por voz.
* O usuário consegue completar o mesmo fluxo por toque.
* O parser funciona sem LLM e com comportamento previsível.
* Sessões conversacionais mantêm `sessionId` consistente.
* Erros de permissão, silêncio, rede e sessão expirada não travam o app.
* Nenhum contrato de backend legado é quebrado.
