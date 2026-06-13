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

### Fase 2: Validação e Contratos (Curto Prazo)
*   **Objetivo:** Padronizar a entrada de dados e as respostas do sistema.
*   **Tarefas Principais:**
    *   Introduzir Zod para validação de esquemas de entrada.
    *   Padronizar payloads de erro e respostas de sucesso.
    *   Documentar os contratos internos que os providers devem seguir.
*   **Módulos Afetados:** `controllers`, `validators` e `shared/middlewares`.
*   **Risco:** Baixo.
*   **Prioridade:** Alta.
*   **Critério de Conclusão:** Todas as rotas principais utilizando validação estruturada.

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

### Fase 5: Contrato de Resposta Estruturada (Médio Prazo)
*   **Objetivo:** Preparar a comunicação Backend-Frontend para o modelo voice-first.
*   **Tarefas Principais:**
    *   Implementar o payload contendo `speechText`, `displayData`, `options` e `expectedInput`.
    *   Adaptar o frontend para reagir a este novo formato de resposta.
*   **Módulos Afetados:** `controllers`, `services` (backend) e `services/ui` (frontend).
*   **Risco:** Alto (mudança no contrato de comunicação principal).
*   **Prioridade:** Alta (essencial para a visão futura).
*   **Critério de Conclusão:** Frontend reproduzindo voz e tela baseado no JSON do backend.

### Fase 6: Intent Detection Determinístico (Médio Prazo)
*   **Objetivo:** Implementar inteligência inicial de baixo custo e alta previsibilidade.
*   **Tarefas Principais:**
    *   Implementar normalização de texto e extração de intents via regras/regex.
    *   Mapear intenções iniciais (`PLAN_JOURNEY`, `CANCEL`, `CONFIRM`).
*   **Módulos Afetados:** `modules/intelligence` (novo).
*   **Risco:** Baixo.
*   **Prioridade:** Média.
*   **Critério de Conclusão:** Sistema identificando intenções básicas sem necessidade de IA externa.

### Fase 7: Dialog Manager Simples (Longo Prazo)
*   **Objetivo:** Gerenciar o estado da conversa e o contexto do usuário.
*   **Tarefas Principais:**
    *   Implementar gerenciamento de sessão (`sessionId`).
    *   Controlar estados lógicos (Waiting, Confirming, etc.).
*   **Módulos Afetados:** `modules/conversation` (novo).
*   **Risco:** Alto (complexidade de gerenciamento de estado).
*   **Prioridade:** Baixa/Média.
*   **Critério de Conclusão:** Ciclo completo de pergunta-resposta mantendo contexto.

### Fase 8: Testes e Observabilidade (Contínua/Longo Prazo)
*   **Objetivo:** Garantir a resiliência e a saúde do sistema.
*   **Tarefas Principais:**
    *   Expandir testes de integração e mocks de providers.
    *   Implementar logs estruturados e monitoramento via Sentry.
    *   *Nota: Testes unitários devem acompanhar todas as fases desde a Fase 1.*
*   **Módulos Afetados:** Todo o projeto.
*   **Risco:** Baixo.
*   **Prioridade:** Contínua.
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
| **Longo Prazo** | 7, 8, 9 | Gerenciamento de Diálogo, Robustez e Maturidade. |
| **Futuro** | 10 | Expansão com Inteligência Artificial Opcional. |

---
*Roadmap sujeito a revisões conforme o aprendizado técnico durante a implementação.*
