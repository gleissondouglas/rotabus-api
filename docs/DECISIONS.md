# Registro de Decisões Arquiteturais (ADR): Nuvem

Este documento segue o formato ADR para registrar decisões arquiteturais importantes do projeto Nuvem. Ele serve como memória técnica, explicando o contexto, as justificativas e as consequências das escolhas feitas durante o desenvolvimento.

---

## Estrutura das Decisões

### [ADR-001] Manutenção de Monólito Modular
*   **Status:** Aceita
*   **Data:** 13/06/2026
*   **Contexto:** O projeto necessita de agilidade no desenvolvimento inicial, facilidade de deploy e baixo custo de infraestrutura.
*   **Decisão:** Manter o backend como um monólito modular. O código é organizado em módulos de domínio (`auth`, `journeys`, `users`), mas compartilha o mesmo processo e base de código.
*   **Alternativas consideradas:** Arquitetura de Microsserviços (descartada por aumentar complexidade de rede, latência e custos operacionais prematuramente).
*   **Consequências positivas:** Facilidade de refatoração, comunicação interna síncrona de baixa latência e simplicidade na gestão de consistência de dados.
*   **Riscos:** Possibilidade de acoplamento entre módulos se as fronteiras não forem respeitadas.
*   **Impacto no roadmap:** Permite focar na qualidade do código interno antes de considerar escalabilidade horizontal complexa.

---

### [ADR-002] Evolução Gradual para Clean Architecture/Hexagonal
*   **Status:** Aceita
*   **Data:** 13/06/2026
*   **Contexto:** O sistema possui lógica de negócio acoplada a formatos de APIs externas, dificultando a testabilidade e manutenção.
*   **Decisão:** Evoluir o sistema de forma incremental para princípios de Clean Architecture, separando o Core (regras de negócio) de detalhes de infraestrutura.
*   **Alternativas consideradas:** Reescrita total (descartada pelo alto risco de regressão) ou manter o acoplamento atual (descartado por limitar o crescimento).
*   **Consequências positivas:** Maior testabilidade, independência de ferramentas e facilidade de manutenção.
*   **Riscos:** Aumento inicial da quantidade de arquivos e abstrações (mappers, interfaces).
*   **Impacto no roadmap:** Inicia-se na Fase 1 com a refatoração de mappers.

---

### [ADR-003] Isolamento do Prisma ORM
*   **Status:** Aceita
*   **Data:** 13/06/2026
*   **Contexto:** O Prisma é utilizado para persistência, mas o Core não deve conhecer detalhes de como os dados são salvos.
*   **Decisão:** Manter o Prisma como ORM, mas isolar seu uso estritamente dentro da camada de Repositories.
*   **Alternativas consideradas:** Usar o Prisma Client diretamente nos Services (prática atual que será desencorajada).
*   **Consequências positivas:** Permite trocar de ORM ou estratégia de banco sem afetar as regras de negócio.
*   **Riscos:** Overhead de mapeamento entre objetos do Prisma e entidades de domínio.
*   **Impacto no roadmap:** Fase 3 (Abstração de Providers/Adapters).

---

### [ADR-004] Abstração de Provedores Google
*   **Status:** Aceita
*   **Data:** 13/06/2026
*   **Contexto:** O sistema depende fortemente das APIs do Google (Routes, Places, Speech).
*   **Decisão:** Criar contratos (interfaces conceituais) para providers. O sistema deve interagir com modelos de dados internos e não com o formato bruto do Google.
*   **Alternativas consideradas:** Manter dependência direta do SDK do Google (dificulta troca de provedor ou testes offline).
*   **Consequências positivas:** Possibilidade de trocar Google por outros provedores (ex: Mapbox, Azure Speech) sem quebrar o sistema.
*   **Riscos:** Necessidade de mappers robustos para converter formatos externos.
*   **Impacto no roadmap:** Fase 3 do ROADMAP.md.

---

### [ADR-005] Proteção Financeira com Cache e Rate Limit
*   **Status:** Aceita
*   **Data:** 13/06/2026
*   **Contexto:** O uso de APIs externas gera custos significativos.
*   **Decisão:** Implementar e manter camadas de `RouteCache` no banco e middlewares de `dailyJourneyLimit`.
*   **Alternativas consideradas:** Confiar apenas no cache de frontend (insuficiente para proteção de custo global).
*   **Consequências positivas:** Previsibilidade de custos e proteção contra abusos ou ataques que poderiam esgotar o orçamento.
*   **Riscos:** Usuários podem receber dados ligeiramente desatualizados se o TTL do cache for muito longo.
*   **Impacto no roadmap:** Decisão consolidada, monitoramento contínuo na Fase 8.

---

### [ADR-006] Paradigma Voice-First, não Voice-Only
*   **Status:** Aceita
*   **Data:** 13/06/2026
*   **Contexto:** O público-alvo necessita de interfaces simplificadas, mas a voz pode falhar em ambientes ruidosos.
*   **Decisão:** O design deve priorizar a voz, mas manter o toque na tela como fallback de acessibilidade e confirmação.
*   **Alternativas consideradas:** Voice-Only (exclui usuários em ambientes barulhentos ou com problemas de fala).
*   **Consequências positivas:** Maior inclusão e resiliência no uso do aplicativo.
*   **Riscos:** Necessidade de manter duas interfaces (fala e visual) sempre sincronizadas.
*   **Impacto no roadmap:** Define o design do Frontend em todas as fases futuras.

---

### [ADR-007] Dialog Manager no Backend
*   **Status:** Aceita
*   **Data:** 13/06/2026
*   **Contexto:** Interações conversacionais exigem persistência de estado e consistência entre múltiplos dispositivos.
*   **Decisão:** O gerenciamento do estado da conversa (etapa atual, intenção, opções) deve residir no Backend.
*   **Alternativas consideradas:** Gerenciamento de estado apenas no Frontend (dificulta consistência e torna o app pesado).
*   **Consequências positivas:** Frontend torna-se uma interface de renderização fina; lógica de fluxo centralizada.
*   **Riscos:** Maior dependência de conectividade para cada passo da conversa.
*   **Impacto no roadmap:** Fase 7 (Dialog Manager simples).

---

### [ADR-008] Intent Detection Determinístico antes de LLM
*   **Status:** Aceita
*   **Data:** 13/06/2026
*   **Contexto:** LLMs possuem alta latência e custo por requisição.
*   **Decisão:** Iniciar com detecção de intenção via regras, regex e normalização de texto. LLMs serão apenas providers opcionais/fallback no futuro.
*   **Alternativas consideradas:** Usar LLM como motor principal desde o início (alto custo e imprevisibilidade).
*   **Consequências positivas:** Baixíssima latência, custo zero de processamento e comportamento 100% previsível.
*   **Riscos:** Menor flexibilidade para entender variações de linguagem muito complexas.
*   **Impacto no roadmap:** Fase 6 do ROADMAP.md.

---

### [ADR-009] LocalIntelligence para Regras Regionais
*   **Status:** Aceita
*   **Data:** 13/06/2026
*   **Contexto:** O sistema possui aliases de locais específicos de Uberaba misturados com a lógica global.
*   **Decisão:** Criar um módulo de `LocalIntelligence` para isolar regras de cidade, aliases e pontos de referência regionais.
*   **Alternativas consideradas:** Manter if/else por cidade nos services (insustentável a longo prazo).
*   **Consequências positivas:** Facilita a expansão para novas cidades sem alterar o Core.
*   **Riscos:** Necessidade de gerenciar múltiplos contextos de localização simultaneamente.
*   **Impacto no roadmap:** Fase 4 do ROADMAP.md.

---

### [ADR-010] Documentação antes de Grandes Refatorações
*   **Status:** Aceita
*   **Data:** 13/06/2026
*   **Contexto:** Refatorar sistemas complexos sem documentação base aumenta drasticamente o risco de erros.
*   **Decisão:** Finalizar a "Fase 0" de documentação (Análise, Arquitetura, Roadmap, ADRs) antes de realizar qualquer alteração estrutural no código.
*   **Alternativas consideradas:** Refatorar primeiro e documentar depois (gera dívida técnica e perda de contexto).
*   **Consequências positivas:** Alinhamento claro entre os envolvidos e redução de riscos na execução.
*   **Riscos:** Sensação momentânea de menor progresso em termos de linhas de código escritas.
*   **Impacto no roadmap:** Define a Fase 0 como pré-requisito obrigatório.

---

### [ADR-011] Validação Padronizada com Zod e Middleware
*   **Status:** Aceita
*   **Data:** 13/06/2026
*   **Contexto:** A validação manual nos controllers causava duplicação de código e dificultava a manutenção de contratos consistentes.
*   **Decisão:** Centralizar a validação de entrada na camada de roteamento usando `validateMiddleware` e schemas Zod para todos os módulos (`auth`, `users`, `journeys`).
*   **Consequências positivas:** Controllers mais limpos e focados em orquestração; dados normalizados garantidos antes da execução da lógica de negócio; mensagens de erro padronizadas.
*   **Riscos:** Necessidade de manter validadores legados nos Services temporariamente até que todas as camadas sejam desacopladas.
*   **Impacto no roadmap:** Conclui a Fase 2 do ROADMAP.md.

---

### [ADR-012] Estratégia de Testes de Integração com Supertest
*   **Status:** Aceita
*   **Data:** 13/06/2026
*   **Contexto:** Necessidade de validar o fluxo completo entre a entrada HTTP, middlewares de segurança/validação e a lógica dos controllers.
*   **Decisão:** Adotar `supertest` para testes de integração de rotas, importando a instância do `app` Express sem iniciar o servidor real. Mockar apenas a camada de `Services` e `Providers` externos para garantir isolamento de banco de dados e APIs de terceiros.
*   **Consequências positivas:** Validação real dos middlewares de validação (Zod) e sanitização; testes rápidos que não dependem de infraestrutura externa; maior confiança na integridade dos contratos da API.
*   **Riscos:** A necessidade de mockar `Services` e `authMiddleware` exige rigor para garantir que os mocks reflitam comportamentos realistas.
*   **Impacto no roadmap:** Conclui a Fase de Integração da Fase 8.

---

*Nota: Estas decisões podem ser revisadas conforme a evolução do projeto. Qualquer mudança significativa deve gerar uma nova ADR ou a atualização do status das anteriores.*
