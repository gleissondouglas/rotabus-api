# Arquitetura do Assistente de Voz: Nuvem

Este documento detalha a visão estratégica e a arquitetura técnica para transformar o Nuvem em um assistente de mobilidade **voice-first**.

---

## 1. Objetivo do Assistente Nuvem

O objetivo é evoluir o sistema de um "aplicativo com comandos de voz" para um **Assistente Conversacional de Mobilidade**. O foco é a acessibilidade e a redução da carga cognitiva, permitindo que o usuário conduza seu trajeto prioritariamente por voz, mantendo a interface visual e o toque como suportes essenciais (**Voice-First, não Voice-Only**).

---

## 2. Estados de Evolução

### 2.1 Estado Atual (Camada Conversacional Inicial Implementada)
*   **Voz como Entrada:** Transcrição de áudio ativa e resolução de destinos com classificação de queries no backend.
*   **Dialog Manager & Session Manager em Memória:** O estado da conversa e FSM são mantidos temporariamente em memória com TTL deslizante de 10 minutos indexados por chave composta `userId:sessionId`.
*   **Contrato de Resposta Conversacional Enriquecido:** O `conversational.mapper.js` decora as respostas de viagens de forma não quebrante na raiz do JSON, mantendo compatibilidade com clientes legados.

### 2.2 Fase Inicial de Evolução (Foco em Persistência Distribuída)
*   **Detecção de Intenção Determinística:** Implementada normalização, aliases locais (Uberaba) no módulo `LocalIntelligence` e classificação de queries. (Concluído)
*   **Contrato de Resposta Estruturada:** Implementado e em produção nos endpoints de rotas. (Concluído)
*   **Dialog Manager Simples:** FSM básica em memória para gerenciar estados e transições de rotas. (Concluído)
*   **Persistência Conversacional no Banco:** Evolução para salvar o estado da sessão conversacional no PostgreSQL para resiliência distribuída. (Futuro)

### 2.3 Visão Futura (Longo Prazo)
*   **Assistente Proativo:** Sugestões baseadas em contexto e histórico.
*   **Adapters para Inteligência Artificial:** Possibilidade de usar LLMs como providers opcionais para lidar com casos complexos de linguagem natural, sem criar dependência obrigatória no Core do sistema.
*   **Sessão Robusta:** Persistência completa do histórico de interações para suporte contínuo.

---

## 3. Pipeline Técnico (Fluxo da Conversa)

O processamento de uma interação segue o fluxo:

1.  **Voice Input (Frontend):** Captura do áudio do usuário.
2.  **Speech-to-Text (Provider):** Conversão de áudio em texto.
3.  **Text Normalization (Core):** Limpeza e padronização do texto capturado.
4.  **Intent Detection (Core):** Identificação da intenção (ex: `PLAN_JOURNEY`, `CONFIRM`).
5.  **Dialog Manager (Core):** Consulta o estado atual da sessão e decide o próximo passo.
6.  **Use Case Execution (Application):** Executa a lógica de negócio (ex: buscar ônibus).
7.  **Structured Response (Backend):** Retorna o payload para o frontend.
8.  **Output (Frontend):** Reproduz a fala (TTS) e renderiza a tela sugerida.

---

## 4. O Coração do Sistema: Dialog Manager & Session

### 4.1 Dialog Manager
Responsável por manter a coerência da conversa, interpretando respostas relativas (ex: "o primeiro", "pode ser", "não, cancela") e garantindo que o usuário saiba em qual etapa do fluxo se encontra.

### 4.2 Conversation Session (Modelo Conceitual)
Para manter o contexto, a sessão deve conter:
*   `sessionId`: Identificador único da interação.
*   `currentState`: Estado lógico (ex: `WAITING_DESTINATION_SELECTION`).
*   `lastIntent`: Última intenção detectada.
*   `presentedOptions`: Lista de opções que foram faladas para o usuário.
*   `expectedInput`: Tipo de resposta aguardada (Voz, Toque ou Ambos).

---

## 5. Contrato de Resposta Estruturada (Exemplo JSON)

O backend deve retornar um objeto que oriente completamente a experiência do usuário:

```json
{
  "speechText": "Encontrei dois hospitais: o Hospital Mário Palmério e o Hospital de Clínicas. Qual deles você prefere?",
  "screen": "DESTINATION_SELECTION",
  "displayData": {
    "title": "Escolha o Hospital",
    "items": [
      { "id": 1, "name": "Hospital Mário Palmério", "distance": "2km" },
      { "id": 2, "name": "Hospital de Clínicas", "distance": "3.5km" }
    ]
  },
  "options": ["Primeiro", "Segundo", "Hospital Mário Palmério", "Hospital de Clínicas"],
  "expectedInput": "VOICE_OR_TOUCH",
  "conversationState": "WAITING_DESTINATION_SELECTION",
  "actions": ["REPEAT", "CANCEL"]
}
```

### 5.1 Protocolo de Tráfego de Sessões
*   **Geração e Retorno:** Se a requisição não fornecer um ID de sessão, o backend gera um UUID dinâmico e o retorna na chave `metadata.sessionId` no payload conversacional.
*   **Reenvio pelo Cliente:** O frontend deve extrair e armazenar esse ID, reenviando-o nas chamadas subsequentes do mesmo diálogo conversacional por meio do cabeçalho HTTP `X-Session-ID` ou da propriedade de corpo da requisição `body.sessionId`.
*   **Armazenamento In-Memory:** As sessões ativas e seus estados lógicos são mantidos temporariamente em memória (`Map`) no backend com sliding window TTL de 10 minutos (a sessão se renova a cada nova chamada). A persistência em banco relacional ainda não está ativa nesta fase.

---

## 6. Divisão de Responsabilidades

### 6.1 Papel do Backend
*   **Orquestração:** Comandar o fluxo da conversa.
*   **Inteligência:** Detectar intenções e gerenciar o estado conversacional.
*   **Regras de Negócio:** Executar cálculos de rota e busca de locais.
*   **Integração:** Isolar e chamar os providers externos (Google, Prisma).

### 6.2 Papel do Frontend
*   **Captura e Reprodução:** Interface de áudio (microfone/fala).
*   **Renderização:** Exibição visual e feedback tátil (Haptics).
*   **Acessibilidade:** Garantir que o toque funcione como fallback para a voz.
*   **Evento:** Enviar as interações do usuário (voz ou clique) de forma transparente para o backend.

---

## 7. Riscos Técnicos

*   **Latência:** O tempo entre a fala do usuário e a resposta do sistema deve ser mínimo.
*   **Erros de Transcrição:** O sistema deve estar preparado para pedir confirmação ou repetição.
*   **Custo de APIs:** O uso intenso de STT e TTS exige uma estratégia de cache e controle de uso.

---
*Este documento define a fundação para a evolução do Nuvem rumo a um assistente conversacional completo.*
