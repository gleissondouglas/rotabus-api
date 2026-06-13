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

## 4. Componentes Conversacionais Implementados

### 4.1 Dialog Manager (`dialog.manager.js`)
*   **Papel:** Máquina de Estados Finita (FSM - Finite State Machine) de diálogo conversacional.
*   **Estados:** Gerencia os estados lógicos da conversa (`IDLE`, `WAITING_DESTINATION`, `WAITING_DESTINATION_SELECTION`, `WAITING_CONFIRMATION`, `JOURNEY_DISPLAYED`, `ERROR`).
*   **Transição:** Processa eventos de viagem/diálogo (ex: `START`, `DESTINATION_RESOLVED`, `DESTINATION_AMBIGUOUS`, `OPTION_SELECTED`, `CONFIRM`, `CANCEL`) para transicionar e manter a coerência das interações de múltiplos turnos.

### 4.2 Session Manager (`session.manager.js`)
*   **Papel:** Gerencia o ciclo de vida temporário das sessões ativas.
*   **Armazenamento:** Estrutura simples de dicionário na memória RAM (`Map` nativo do Node.js).
*   **Isolamento:** Chaves compostas formatadas como `userId:sessionId` (ou `anonymous:sessionId` para usuários deslogados), garantindo barreiras rígidas de segurança entre contextos.
*   **Sliding TTL:** Janela deslizante de **10 minutos** (`DEFAULT_TTL_MS`). A validade expira caso nenhuma chamada ocorra no intervalo, renovando-se a cada acesso.
*   **Limitação:** O estado conversacional **não é persistido de forma durável em banco de dados ou Redis**. A sessão é destruída caso o servidor backend seja reiniciado.

### 4.3 Conversational Mapper (`conversational.mapper.js`)
*   **Papel:** Camada de apresentação/decorator. Injeta as propriedades conversacionais (`speechText`, `displayData`, `options`, `expectedInput`, `actions`, `conversationState` e `metadata.sessionId`) na raiz das respostas JSON originais, garantindo total retrocompatibilidade e preservação dos campos legados.

---

## 5. Contrato de Resposta Estruturada

O backend retorna um objeto estruturado híbrido para guiar o frontend na reprodução de voz e renderização de telas:

```json
{
  "speechText": "Encontrei dois hospitais: o Hospital Mário Palmério e o Hospital de Clínicas. Qual deles você prefere?",
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

### 5.1 Protocolo de Tráfego de Sessões
*   **Geração:** Se a requisição não fornecer um `sessionId`, o backend gera um UUID dinâmico via `crypto.randomUUID` e o retorna em `metadata.sessionId`.
*   **Reenvio pelo Cliente:** O frontend deve armazenar esse ID e reenviá-lo nas chamadas subsequentes. O backend aceita esse reenvio de duas formas:
    1.  Pelo cabeçalho HTTP **`X-Session-ID`**.
    2.  Pela propriedade **`sessionId`** no corpo JSON da requisição.
*   **Persistência Futura (PostgreSQL/Redis):** A migração do Map em memória para um cache distribuído ou tabela do banco para suporte tolerante a falhas é postergada para evolução futura no roadmap.

### 5.2 Fluxo de Comandos Conversacionais (`POST /journeys/command`)

Este endpoint público expõe a habilidade do frontend de enviar comandos e ações diretas de áudio ou toque:
*   **Contrato:** Aceita `sessionId` (obrigatório, UUID válido), `command` (obrigatório, um dos comandos definidos em `actions`) e `payload` (opcional).
*   **Comandos Suportados:**
    -   `CANCEL` -> Transiciona o estado FSM para `IDLE` e exclui a sessão temporária ativa.
    -   `REPEAT` -> Mantém o mesmo estado conversacional ativo e retorna a mensagem anterior para repetição pelo TTS.
    -   `CONFIRM` -> Avança de `WAITING_CONFIRMATION` para `JOURNEY_DISPLAYED`.
    -   `SELECT_OPTION` -> Avança de `WAITING_DESTINATION_SELECTION` para `JOURNEY_DISPLAYED` atualizando os metadados da opção selecionada.

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
