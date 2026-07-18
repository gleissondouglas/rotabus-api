# Histórico e Decisões Arquiteturais (ADRs)

Este documento registra as principais escolhas técnicas do projeto e os motivos que levaram a essas direções ao longo da história do Nuvem (RotaBus-API).

## ADR-001: Monólito Modular
- **Contexto:** Havia um debate sobre fragmentar as integrações Google Routes em Microsserviços para facilitar o versionamento isolado de IA.
- **Decisão:** Manter um Monólito Modular Node.js (Express).
- **Justificativa:** Overengineering. Para o time atual, gerir complexidade de rede entre microsserviços atrasaria as validações de hipótese do produto e não há tráfego volumoso o suficiente para justificar custos isolados. Camadas bem isoladas (`/modules`) simulam o benefício do serviço fragmentado sem o custo.

## ADR-002: Utilização de Server-Driven UI (SDUI)
- **Contexto:** Precisávamos decidir se o frontend gerenciaria a conversa ou seria apenas um terminal.
- **Decisão:** Frontend burro, Backend dita regras (Payload conversacional contendo tela, speechText e expectedInput).
- **Justificativa:** Lançamentos nas Lojas (Apple e Play Store) demoram dias. Se o mapeamento de rota mudasse ou a frase falada do robô precisasse ser corrigida para maior empatia com PCDs, o SDUI permite alterar o comportamento imediatamente para todos via Deploy do Backend.

## ADR-003: Bloqueio Rigoroso do ORM (Prisma Client)
- **Contexto:** Serviços começaram a chamar `prisma.user.findFirst` no meio de lógicas de mapa.
- **Decisão:** Proibido injetar dependência de Banco fora de `Repositories`.
- **Justificativa:** Garantir o Princípio de Inversão de Dependência (SOLID - DIP). Facilita os mocks no Jest (Mockamos o Repository e não o banco inteiro). Se no futuro precisarmos trocar do Postgres para um NoSQL de Alta performance (MongoDB), os Casos de Uso continuam intactos.

## ADR-004: FSM (Sessão) Persistida no PostgreSQL
- **Contexto:** A Máquina de Estados da Conversa rodava no `Map` global do Node.js (`memory`).
- **Decisão:** Alterada para usar `Driver: Postgres` e tabela `ConversationSession` em produção.
- **Justificativa:** A escalabilidade Cloud nativa (Deployments em nuvem) reinicia os containers sem aviso (Spin-down) ou roda réplicas paralelas. Se a conversa rodar localmente no Container 1 e o usuário mandar a resposta que for balanceada para o Container 2, ocorreria erro de Sessão 404. O BD centraliza o estado agnosticamente.

## ADR-005: Voice-First Híbrido, Não Voice-Only
- **Contexto:** Visão radical inicial desejava que a tela fosse 100% limpa, forçando interação via microfone exclusivamente.
- **Decisão:** Implementação híbrida obrigatória (Fallback Visual Permanente).
- **Justificativa:** Entrevistas de produto revelaram que: Idosos no transporte coletivo se recusam a falar com o telefone por constrangimento; ambientes ensurdedores quebram o STT. O app é assistente conversacional, mas todos os fluxos possuem botões físicos na tela correspondentes às respostas.

## ADR-006: Escolha do Expo e React Native
- **Contexto:** Definição de framework mobile.
- **Decisão:** Expo Application Services com file-based routing.
- **Justificativa:** Velocidade de iteração imbatível; Permite OTA (Over the air updates) pulando as burocracias de loja; Maior disponibilidade de pacotes de acessibilidade nativos empacotados (`expo-speech`, `expo-haptics`).
