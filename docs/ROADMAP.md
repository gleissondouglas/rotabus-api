# Roadmap de Evolução Técnica: Nuvem (RotaBus-API)

Este documento descreve o plano de evolução gradual do sistema Nuvem, saindo do estado atual para uma arquitetura profissional, modular e preparada para a visão **voice-first**.

---

## 1. Visão Geral do Roadmap

A evolução será realizada de forma incremental, evitando reescritas totais e priorizando a estabilidade do que já está funcional. O projeto continuará operando como um **monólito modular**, incorporando gradualmente princípios de **Clean Architecture** e **Hexagonal Architecture** para proteger o núcleo de regras de negócio contra dependências externas.

---

## 2. Cronograma de Fases

### Fase 0: Consolidação da Documentação (Curto Prazo)
*   **Objetivo:** Criar a base de conhecimento técnica e estratégica do projeto.
*   **Tarefas Principais:**
    *   Revisar `PROJECT_ANALYSIS.md`, `ARCHITECTURE.md` e `VOICE_ASSISTANT_ARCHITECTURE.md`.
    *   Criar `DECISIONS.md`, `API.md`, `DATABASE.md`, `SECURITY.md` e `AGENTS.md`.
*   **Módulos Afetados:** Pasta `docs/`.
*   **Risco:** Baixo.
*   **Prioridade:** Crítica.
*   **Critério de Conclusão:** Todos os documentos de base criados e aprovados.

### Fase 1: Refatoração Segura do Mapper (Curto Prazo)
*   **Objetivo:** Decompor o `journey.mapper.js` em arquivos menores e gerenciáveis sem alterar o comportamento atual.
*   **Tarefas Principais:**
    *   Criar testes unitários para o comportamento atual do mapper.
    *   Extrair utilitários de `time`, `distance`, `text`, `instructions` e `voice`.
    *   Garantir que as respostas JSON enviadas ao frontend permaneçam idênticas.
*   **Módulos Afetados:** `backend/src/modules/journeys/journey.mapper.js`.
*   **Risco:** Moderado (risco de quebrar a formatação visual no frontend).
*   **Prioridade:** Alta.
*   **Critério de Conclusão:** Mapper decomposto e validado por testes, com paridade total de comportamento.

### Fase 2: Validação e Contratos (Concluída)
*   **Objetivo:** Padronizar a entrada de dados e as respostas do sistema.
*   **Tarefas Realizadas:**
    *   Introdução do Zod para validação de esquemas de entrada em `auth`, `users` e `journeys`.
    *   Criação e aplicação do `validateMiddleware` genérico nas rotas principais.
    *   Simplificação dos controllers com a remoção de chamadas manuais de validação.
    *   Preservação de compatibilidade com campos legados (ex: `departureTime` em journeys).
    *   Manutenção temporária de validadores legados para evitar quebra de Services e Testes.
*   **Status:** Concluída.
*   **Critério de Conclusão:** Todas as rotas principais utilizando validação estruturada via middleware.

### Fase 3: Abstração de Providers/Adapters (Médio Prazo)
*   **Objetivo:** Impedir que o core do sistema dependa de formatos de resposta de APIs externas.
*   **Tarefas Principais:**
    *   Isolar Google Routes, Places, Speech e Geocoding.
    *   Encapsular o Prisma dentro da camada de Repositories.
    *   Criar modelos de dados internos independentes dos SDKs externos.
*   **Módulos Afetados:** `providers`, `repositories` e `services`.
*   **Risco:** Moderado (necessita mapeamento cuidadoso de dados).
*   **Prioridade:** Média.
*   **Critério de Conclusão:** Core do sistema sem referências diretas a formatos do Google ou Prisma.

### Fase 4: LocalIntelligence (Médio Prazo)
*   **Objetivo:** Isolar regras regionais e contextuais (ex: Uberaba).
*   **Tarefas Principais:**
    *   Remover aliases e pontos de referência hardcoded dos serviços.
    *   Criar o módulo `LocalIntelligence` para gerenciar contexto de cidades.
*   **Módulos Afetados:** `modules/journeys/journeys.service.js`.
*   **Risco:** Baixo.
*   **Prioridade:** Média.
*   **Critério de Conclusão:** Expansão para uma nova cidade possível apenas via configuração/banco.

### Fase 5: Contrato de Resposta Estruturada (Concluída no Backend)
*   **Objetivo:** Preparar a comunicação Backend-Frontend para o modelo voice-first.
*   **Tarefas Realizadas:**
    *   Implementar o payload conversacional contendo `speechText`, `displayData`, `options`, `expectedInput`, `actions` e `conversationState` integrado de forma retrocompatível à API atual.
*   **Status:** Concluída no backend.
*   **Critério de Conclusão:** Backend retornando payload híbrido enriquecido sem quebra técnica das propriedades clássicas.

### Fase 6: Intent Detection Determinístico (Médio Prazo)
*   **Objetivo:** Implementar inteligência inicial de baixo custo e alta previsibilidade.
*   **Tarefas Principais:**
    *   Implementar normalização de texto e extração de intents via regras/regex.
    *   Mapear intenções iniciais (`PLAN_JOURNEY`, `CANCEL`, `CONFIRM`).
*   **Módulos Afetados:** `modules/intelligence` (novo).
*   **Risco:** Baixo.
*   **Prioridade:** Média.
*   **Critério de Conclusão:** Sistema identificando intenções básicas sem necessidade de IA externa.

### Fase 7: Dialog Manager e Persistência Conversacional (Concluída no Backend)
*   **Objetivo:** Gerenciar o estado da conversa e o contexto do usuário.
*   **Tarefas Realizadas:**
    *   Implementar gerenciamento de sessão (`sessionId`) em memória com sliding TTL de 10 minutos.
    *   Controlar estados lógicos (Waiting, Confirming, etc.) por meio de uma FSM.
    *   Migrar o armazenamento das sessões conversacionais para persistência durável no PostgreSQL (Supabase) via Prisma com driver híbrido intercambiável.
*   **Status:** Concluída no Backend (Persistência durável no PostgreSQL implementada via Prisma. Detalhes em [ADR-014](file:///Users/douglasoliveira/Desktop/RotaBus-API/docs/DECISIONS.md) e [CONVERSATIONAL_SESSION_PERSISTENCE_PLAN.md](file:///Users/douglasoliveira/Desktop/RotaBus-API/docs/CONVERSATIONAL_SESSION_PERSISTENCE_PLAN.md)).
*   **Critério de Conclusão:** Sessões conversacionais persistidas de forma durável no banco PostgreSQL com suporte a deploys e escalabilidade horizontal.

### Fase 7.1: Loop Conversacional por Voz no Frontend (Planejada)
*   **Objetivo:** Planejar e implementar gradualmente o loop voice-first no frontend, em que a assistente fala, aguarda o fim do TTS, ativa o microfone e converte respostas simples em comandos conversacionais existentes.
*   **Tarefas Planejadas:**
    *   Implementar uma API de fala aguardável (`speakAndWait`) no serviço de voz.
    *   Criar um parser determinístico inicial para respostas como "sim", "não", "repetir", "primeira", "segunda" e "terceira".
    *   Criar um orquestrador local para controlar os estados de fala, escuta, processamento e cancelamento.
    *   Integrar o loop em etapas nas telas `inicio`, `confirmar-destino`, opções de destino e `melhor-rota`.
*   **Status:** Planejamento concluído em `docs/VOICE_CONVERSATION_LOOP_PLAN.md`; implementação futura dividida em branches incrementais.
*   **Critério de Conclusão:** Usuário consegue conduzir o fluxo principal por voz sem quebrar o fallback por toque, sem ativar microfone durante TTS e sem alterar contratos legados do backend.

### Fase 8: Testes e Observabilidade (Contínua - Fase de Integração Concluída)
*   **Objetivo:** Garantir a resiliência e a saúde do sistema através de testes automatizados e monitoramento.
*   **Tarefas Realizadas (Integração):**
    *   Implementação de testes de integração para as rotas principais de `auth`, `users` e `journeys`.
    *   Utilização do `supertest` para validar o fluxo real: Rota → Middlewares → Controller.
    *   Mocks estratégicos de Services e Providers para evitar chamadas a APIs externas (Google), Banco de Dados e e-mail.
    *   Preservação e validação dos middlewares reais de `sanitizeMiddleware` e `validateMiddleware`.
    *   **Validação Manual E2E:** Criação de roteiro estruturado para validação manual ponta a ponta (`docs/CONVERSATIONAL_E2E_MANUAL_TEST.md`) integrando o fluxo conversacional entre frontend e backend.
*   **Status:** Em progresso (Integração de rotas concluída).
*   **Critério de Conclusão:** Cobertura de testes em áreas críticas e alertas configurados.

### Fase 9: Documentação de API e Segurança (Longo Prazo)
*   **Objetivo:** Formalizar o sistema para auditorias e integrações.
*   **Tarefas Principais:**
    *   Refinar `API.md` e `SECURITY.md`.
    *   Implementar documentação OpenAPI (Swagger).
*   **Módulos Afetados:** `docs/`.
*   **Risco:** Baixo.
*   **Prioridade:** Baixa.
*   **Critério de Conclusão:** Documentação completa e interativa disponível.

### Fase 10: Evolução com IA (Futuro/Opcional)
*   **Objetivo:** Adicionar camadas de linguagem natural avançada.
*   **Tarefas Principais:**
    *   Integrar LLM como provider opcional (fallback/NLP complexo).
    *   Implementar RAG para suporte ao usuário.
*   **Módulos Afetados:** `providers`, `modules/intelligence`.
*   **Risco:** Baixo (como provider opcional).
*   **Prioridade:** Opcional.
*   **Critério de Conclusão:** IA integrada sem ser dependência crítica do núcleo.

---

## 3. Resumo das Fases por Prazo

| Prazo | Fases | Foco Principal |
| :--- | :--- | :--- |
| **Curto Prazo** | 0, 1, 2 | Estabilização, Documentação e Limpeza de Código. |
| **Médio Prazo** | 3, 4, 5, 6 | Desacoplamento, Inteligência Local e Base Conversacional. |
| **Longo Prazo** | 7, 7.1, 8, 9 | Gerenciamento de Diálogo, Loop de Voz, Robustez e Maturidade. |
| **Futuro** | 10 | Expansão com Inteligência Artificial Opcional. |

---
*Roadmap sujeito a revisões conforme o aprendizado técnico durante a implementação.*
