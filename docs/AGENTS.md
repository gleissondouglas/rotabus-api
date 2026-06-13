# Protocolo para Agentes de IA: Nuvem

Este documento orienta agentes de IA e assistentes de código no desenvolvimento do projeto Nuvem. Seu objetivo é garantir que toda automação e sugestão de código respeitem a arquitetura, as decisões técnicas e a visão de longo prazo já estabelecidas.

---

## 1. Contexto Obrigatório

Antes de sugerir qualquer alteração ou implementação, o agente **deve** ler obrigatoriamente os seguintes documentos:

1.  `docs/PROJECT_ANALYSIS.md`: Diagnóstico e estado atual do sistema.
2.  `docs/ARCHITECTURE.md`: Princípios arquiteturais e evolução planejada.
3.  `docs/VOICE_ASSISTANT_ARCHITECTURE.md`: Visão estratégica voice-first.
4.  `docs/ROADMAP.md`: Fases de evolução técnica.
5.  `docs/DECISIONS.md`: Registro de Decisões Arquiteturais (ADRs).

---

## 2. Regras Gerais de Atuação

*   **Não altere código sem plano:** Apresente uma estratégia clara antes de editar qualquer arquivo.
*   **Aprovação Antecipada:** Implementações só devem ocorrer após o usuário aprovar o plano proposto.
*   **Conservadorismo Arquitetural:** Respeite o modelo de Monólito Modular. Não sugira microsserviços.
*   **Desacoplamento:** Mantenha o Core independente de ferramentas externas (Google, Prisma, Speech APIs, LLMs).
*   **Proteção de Custo:** Jamais remova validações, rate limits ou mecanismos de cache sem justificativa sólida.

---

## 3. Mapa de Responsabilidades por Camada

Para manter a consistência, o agente deve seguir esta distribuição de papéis:

*   **Routes:** Registro e definição de endpoints.
*   **Controllers:** Receber a requisição, extrair dados necessários e delegar para os services/use cases. Não devem conter lógica de negócio.
*   **Validators/Schemas:** Concentrar as validações de entrada de dados.
*   **Services / Use Cases:** Orquestrar as regras de negócio puras. Não devem conhecer detalhes HTTP (`req`, `res`).
*   **Repositories:** Abstração de acesso ao banco de dados (Prisma).
*   **Providers / Adapters:** Isolar integrações com APIs externas.
*   **Mappers:** Converter formatos externos para modelos internos do sistema.
*   **Frontend:** Captura de áudio, reprodução de fala, interface visual, permissões e acessibilidade.
*   **Backend:** Regras de negócio, orquestração, estado conversacional e gestão de provedores.

---

## 4. Fluxo Obrigatório de Trabalho

O agente deve operar seguindo rigorosamente estas etapas:

1.  **Ler Documentação:** Carregar o contexto dos arquivos listados na Seção 1.
2.  **Entender a Tarefa:** Confirmar os requisitos com o usuário.
3.  **Analisar Impacto:** Verificar dependências e riscos.
4.  **Propor Plano:** Apresentar a estratégia detalhada (ver Seção 5).
5.  **Aguardar Aprovação:** Não agir até receber o "ok" do usuário.
6.  **Implementação Cirúrgica:** Aplicar mudanças pequenas e focadas.
7.  **Verificar:** Executar ou solicitar testes para validar a mudança.
8.  **Explicar Resultado:** Resumir o que foi feito e o que foi alcançado.
9.  **Atualizar Documentação:** Sincronizar os documentos afetados pela mudança.

---

## 5. Protocolo para Proposta de Mudança

Antes de qualquer alteração, o agente deve informar:

*   **Objetivo:** O que a mudança resolve.
*   **Arquivos Afetados:** Lista de caminhos de arquivos.
*   **Escopo de Impacto:** Backend, Frontend, Banco de Dados, API, Segurança e/ou Documentação.
*   **Risco:** Nível de risco e possíveis efeitos colaterais.
*   **Estratégia de Teste:** Como a mudança será validada.
*   **Necessidade de Atualização Doc:** Quais arquivos em `docs/` precisam ser revisados.

---

## 6. Proibições Explícitas

Agentes de IA estão proibidos de realizar as seguintes ações:

*   Reescrever o projeto inteiro de uma só vez.
*   Sugerir ou implementar microsserviços.
*   Tratar o projeto como uma Clean Architecture já finalizada (o estado é de evolução gradual).
*   Introduzir LLMs como dependência central ou obrigatória do sistema.
*   Colocar lógica de negócio dentro de Controllers.
*   Utilizar objetos de Request/Response (`req`, `res`) dentro de Services.
*   Expor chaves de API ou segredos no frontend.
*   Remover cache, rate limit ou proteções financeiras sem justificativa aprovada.
*   Alterar contratos de API sem atualizar o arquivo `docs/API.md`.
*   Alterar schemas de banco sem atualizar o arquivo `docs/DATABASE.md`.
*   Alterar fluxos de autenticação/segurança sem atualizar o arquivo `docs/SECURITY.md`.

---

## 7. Princípios Voice-First

Toda implementação de interface deve lembrar:
*   **Voice-First ≠ Voice-Only:** A voz é o canal principal, mas o toque é o fallback obrigatório de acessibilidade.
*   **Intent Detection:** Priorizar métodos determinísticos (Regex/Regras) iniciais.
*   **Dialog Manager:** Deve evoluir gradualmente conforme planejado em `VOICE_ASSISTANT_ARCHITECTURE.md`.

---
*Este protocolo garante a integridade e a continuidade técnica do projeto Nuvem.*
