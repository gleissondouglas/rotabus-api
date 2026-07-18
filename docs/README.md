# Dossiê Técnico Profissional: Nuvem (RotaBus-API)

Bem-vindo ao dossiê técnico do projeto **Nuvem** (conhecido internamente como RotaBus-API). 
Esta documentação foi elaborada para atuar como a fonte definitiva de verdade (Single Source of Truth) para o desenvolvimento, manutenção e evolução arquitetural do sistema.

## O que é o Nuvem?
O Nuvem é uma plataforma de mobilidade urbana assistida com uma abordagem **Voice-First**, projetada prioritariamente para democratizar o acesso ao transporte público, reduzindo a carga cognitiva e facilitando a navegação para idosos, pessoas com deficiência (PCDs) e usuários com baixa literacia digital.

## Mapa da Documentação

A documentação está dividida em módulos focados para facilitar a leitura, desde o onboarding de novos desenvolvedores até a auditoria técnica de arquitetos de software.

### Visão e Produto
* [00-VISAO-GERAL.md](./00-VISAO-GERAL.md): Objetivo, problema, missão, impacto social e diferenciais.
* [01-PROJETO.md](./01-PROJETO.md): História, motivação, escopo, requisitos e limitações.

### Arquitetura e Engenharia
* [02-ARQUITETURA.md](./02-ARQUITETURA.md): Desenho arquitetural, camadas, fluxos de comunicação e diagramas.
* [03-DOMINIO.md](./03-DOMINIO.md): Regras de negócio, casos de uso, estados e eventos.
* [04-FLUXOS.md](./04-FLUXOS.md): Fluxogramas detalhados de todas as jornadas do usuário.
* [05-FRONTEND.md](./05-FRONTEND.md): Estrutura do App (React Native/Expo), gerenciamento de estado e navegação.
* [06-BACKEND.md](./06-BACKEND.md): Estrutura da API (Node.js/Express), controllers, middlewares e validações.
* [07-DATABASE.md](./07-DATABASE.md): Modelagem de dados, PostgreSQL, Prisma ORM e justificativas.

### Especialidades
* [08-IA.md](./08-IA.md): Funcionamento, prompts (se aplicável), cache e inteligência local.
* [09-VOZ.md](./09-VOZ.md): Ciclo conversacional, TTS, STT, timeouts e permissões.
* [10-GOOGLE-APIS.md](./10-GOOGLE-APIS.md): Integrações com Routes, Places, Geocoding e estratégias de custo.

### Qualidade e Segurança
* [11-SEGURANCA.md](./11-SEGURANCA.md): Autenticação (JWT), LGPD, proteção de rotas e rate limit.
* [12-CACHE.md](./12-CACHE.md): Estratégias de invalidação, TTL e performance.
* [13-TESTES.md](./13-TESTES.md): Diretrizes para testes unitários, integração e E2E.

### Design e Produto
* [14-DESIGN-SYSTEM.md](./14-DESIGN-SYSTEM.md): Tokens, tipografia, cores e componentes.
* [15-UX.md](./15-UX.md): Acessibilidade, fluxo conversacional e heurísticas aplicadas.

### Operações e Evolução
* [16-CONTRATOS-API.md](./16-CONTRATOS-API.md): Documentação dos endpoints, requisições e respostas.
* [17-INFRAESTRUTURA.md](./17-INFRAESTRUTURA.md): Docker, CI/CD, variáveis de ambiente e deploy.
* [18-ROADMAP.md](./18-ROADMAP.md): Planejamento, dívidas técnicas e visões futuras.
* [19-HISTORICO.md](./19-HISTORICO.md): ADRs (Architecture Decision Records) e histórico de mudanças.
* [20-CONTRIBUICAO.md](./20-CONTRIBUICAO.md): Guia de instalação, padrões de commit e abertura de PRs.

---
> **Nota do Arquiteto:** Este documento baseia-se puramente no código existente. Seções ou fluxos que representam o futuro da aplicação estão devidamente marcados como "Visão Futura" ou "Pendente de Implementação".
