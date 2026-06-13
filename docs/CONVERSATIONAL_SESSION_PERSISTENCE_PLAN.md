# Plano de Persistência de Sessões Conversacionais: Nuvem

Este documento apresenta a análise técnica, modelagem e plano de implementação futura para evoluir o armazenamento de sessões conversacionais do Nuvem de uma solução em memória para um banco de dados durável e distribuído.

---

## 1. Analise do Estado Atual

No estado atual do backend, o gerenciamento do estado conversacional é orquestrado de forma centralizada pelo [session.manager.js](file:///Users/douglasoliveira/Desktop/RotaBus-API/backend/src/modules/journeys/dialog/session.manager.js).

### 1.1 Funcionamento Atual
Atualmente, as sessões ativas são guardadas em uma estrutura de dados `Map` em memória RAM global do Node.js:
```javascript
const sessions = new Map();
```

### 1.2 Uso de `sessionId`
Cada interação que inicia um diálogo conversacional gera um identificador único de sessão (`sessionId`) utilizando `crypto.randomUUID` (ou fallback seguro em Hex).
Para isolar os dados de diferentes usuários, o sistema gera uma chave composta chamada `compositeKey` pela função `getCompositeKey(userId, sessionId)`:
- Se o usuário estiver autenticado: `${userId}:${sessionId}`
- Se o usuário for anônimo/deslogado: `anonymous:${sessionId}`

Essa chave composta é utilizada como indexador no `Map` global de sessões, garantindo que o contexto seja isolado.

### 1.3 TTL e Expiração Deslizante (Sliding Expiration)
O tempo de vida padrão de uma sessão inativa é definido por `DEFAULT_TTL_MS` em 10 minutos (600.000 ms).
O sistema adota uma estratégia de expiração deslizante (**Sliding Expiration**). Toda vez que o método `getSession` ou `updateSession` é executado, a sessão tem seu timestamp de expiração estendido para `now() + DEFAULT_TTL_MS`, garantindo que sessões ativamente utilizadas pelo usuário não expirem.

### 1.4 Integração com DialogManager e Command Handler
O fluxo de consumo da sessão funciona da seguinte forma:
1. **Controllers ([journeys.controller.js](file:///Users/douglasoliveira/Desktop/RotaBus-API/backend/src/modules/journeys/journeys.controller.js)):**
   - Ao receber requisições de planejamento (`/plan`) ou de resolução de destino (`/resolve-destination`), o controller solicita a sessão pelo cabeçalho `X-Session-ID` ou pela propriedade `sessionId` do corpo HTTP.
   - Caso a sessão não seja encontrada, o [session.manager.js](file:///Users/douglasoliveira/Desktop/RotaBus-API/backend/src/modules/journeys/dialog/session.manager.js) cria uma nova sessão iniciando no estado `IDLE`.
   - Após as chamadas de serviços e a definição do evento, o controller invoca o [dialog.manager.js](file:///Users/douglasoliveira/Desktop/RotaBus-API/backend/src/modules/journeys/dialog/dialog.manager.js) para transicionar o estado (FSM) e atualiza a sessão ativamente em memória.
2. **Command Handler ([conversation-command.handler.js](file:///Users/douglasoliveira/Desktop/RotaBus-API/backend/src/modules/journeys/dialog/conversation-command.handler.js)):**
   - Processa ações diretas enviadas pelo usuário (`CANCEL`, `REPEAT`, `CONFIRM`, `SELECT_OPTION`).
   - Verifica se a transição da máquina de estados é válida para o estado atual da sessão.
   - Deleta a sessão sob o comando `CANCEL` ou atualiza seu estado e metadados nos casos de confirmação/seleção.

### 1.5 Riscos do Modelo Atual
A arquitetura em memória atual apresenta três riscos severos para a operação do Nuvem:
1. **Perda de Estado Conversacional no Restart do Backend:** Se a instância Node.js reiniciar devido a deploy, travamento, falta de recursos ou reinicialização agendada da infraestrutura (como no Heroku/Render/Supabase), todas as sessões ativas são excluídas. O usuário terá seu diálogo interrompido no meio de um fluxo de confirmação e precisará recomeçar a conversa do zero.
2. **Impossibilidade de Escala Horizontal (Múltiplas Instâncias):** Se o backend for escalado para duas ou mais instâncias de servidores rodando em paralelo atrás de um Load Balancer, as requisições subsequentes de um usuário podem cair em instâncias diferentes. Como a memória do processo Node.js não é compartilhada, a nova instância não encontrará a sessão ativa, causando erros de sessão expirada de forma intermitente.
3. **Persistência Limitada e Monitoramento Inexistente:** Não há registro durável dos estados de falha ou descontinuidade dos diálogos dos usuários. Fica inviável analisar as taxas de abandono (funil conversacional) de forma analítica com base em dados consolidados em banco de dados.

---

## 2. Comparação de Opções de Persistência

Abaixo, avaliamos três abordagens viáveis para evoluir o sistema de persistência de sessões conversacionais do Nuvem.

| Critério | PostgreSQL / Supabase (Prisma) | Redis Cache | Manter em Memória (Map) |
| :--- | :--- | :--- | :--- |
| **Vantagens** | • Reutiliza a infraestrutura de banco de dados e ORM já existentes no projeto.<br>• Persistência durável confiável.<br>• Suporta consultas complexas e junções com a tabela `User` para auditorias e BI.<br>• Custo adicional zero. | • Baixíssima latência (em microssegundos) ideal para cache.<br>• TTL gerenciado de forma nativa pelo próprio motor Redis.<br>• Excelente performance para leitura/escrita rápida de sessões. | • Latência próxima de zero (acesso direto à RAM local).<br>• Zero complexidade de configuração externa.<br>• Não há tráfego de rede para recuperar o estado. |
| **Desvantagens** | • Latência de leitura/escrita ligeiramente superior ao Redis/RAM (milissegundos).<br>• Necessidade de gerenciar a limpeza de registros expirados de forma programática ou via Cron. | • Introduz uma nova dependência de infraestrutura e custo operacional.<br>• Aumenta a complexidade de configuração de variáveis de ambiente (`.env`) e docker local.<br>• Complexidade no mapeamento com ORM Prisma. | • Perda de dados no reinício da aplicação.<br>• Inviabiliza escalabilidade horizontal e balanceamento de carga.<br>• Risco de vazamento de memória se o processo falhar ao expirar dados. |
| **Complexidade** | **Baixa**: Usa as abstrações do Prisma que a equipe já domina. | **Média**: Exige configurar client Redis, gerenciar conexões e lidar com fallbacks em caso de indisponibilidade da instância Redis. | **Nula**: Nenhuma alteração de infraestrutura. |
| **Custo/Infra** | **Zero**: Aproveita a conexão existente no Supabase/PostgreSQL. | **Adicional**: Custos de provisionamento de uma instância Redis dedicada (ex: Upstash, Redis Labs, AWS). | **Zero**: Consumo marginal da RAM atual do container. |
| **Aderência ao Estágio** | **Altíssima**: O projeto está em fase inicial de consolidação e já utiliza Prisma + Supabase, tornando essa a opção ideal de menor fricção operacional. | **Baixa**: Prematuro para a volumetria atual do aplicativo. Adiciona overhead desnecessário neste momento. | **Inadequada**: Apresenta riscos críticos para produção (perda de contexto em deploy). |

### Recomendação Final
A recomendação inicial e definitiva para a evolução do Nuvem é a adoção do **PostgreSQL/Supabase via Prisma**. A escolha baseia-se no princípio da simplicidade e aproveitamento de recursos (YAGNI - *You Aren't Gonna Need It* para Redis neste momento). Como o tráfego atual permite suporte de leitura e escrita com latência de banco aceitável, a unificação do stack de dados no Prisma com PostgreSQL reduz a complexidade operacional, permite auditorias relacionais fáceis e elimina custos de infraestrutura adicionais.

---

## 3. Modelagem de Banco de Dados Proposta

Abaixo, descrevemos a proposta de modelo conceitual do Prisma para a entidade `ConversationSession` a ser adicionada futuramente no [schema.prisma](file:///Users/douglasoliveira/Desktop/RotaBus-API/backend/prisma/schema.prisma).

### 3.1 Definição do Modelo no Prisma
```prisma
model ConversationSession {
  id           String    @id @default(uuid())
  sessionId    String    @unique
  userId       Int?
  currentState String    @default("IDLE")
  context      Json      // Armazena variáveis extras e dados de rotas parciais
  expiresAt    DateTime
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  endedAt      DateTime? // Registra quando o usuário encerrou voluntariamente a conversa (ex: CANCEL)

  // Relacionamento opcional com o modelo User existente
  user         User?     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([sessionId])
  @@index([userId])
  @@index([expiresAt])
  @@index([userId, sessionId])
}
```

### 3.2 Avaliação dos Campos
1. **`id`**: String UUID auto-gerada. Atua como chave primária física no banco.
2. **`sessionId`**: String UUID gerada pela aplicação no fluxo conversacional. Possui restrição de unicidade (`@unique`) para indexação rápida.
3. **`userId`**: Referência opcional (`Int?`) ao ID numérico do usuário logado na tabela `User`. Permite associar a sessão ao usuário se ele estiver logado, ou manter nulo para fluxos anônimos. A relação possui `onDelete: Cascade` para limpar sessões antigas automaticamente se um usuário excluir sua conta (LGPD).
4. **`currentState`**: String que mapeia o estado lógico da FSM (`IDLE`, `WAITING_DESTINATION`, etc.). Default definido como `"IDLE"`.
5. **`context`**: Tipo de dados `Json` nativo do PostgreSQL. Armazena dados flexíveis de diálogo (ex: a busca original por texto do usuário, opções temporárias enviadas para seleção, index selecionado, etc.) sem enrijecer o schema.
6. **`expiresAt`**: Timestamp absoluto indicando quando a sessão deve expirar. Utilizado para controle do Sliding TTL.
7. **`createdAt` e `updatedAt`**: Carimbos de data para fins de auditoria e monitoramento de desempenho.
8. **`endedAt`**: Data/hora preenchida caso a conversa chegue a uma conclusão lógica ou seja explicitamente cancelada. Ajuda em relatórios analíticos de engajamento do assistente de voz.

### 3.3 Índices Necessários e Justificativas
*   `@@index([sessionId])`: Acelera drasticamente a busca da sessão por ID em cada chamada da API conversacional.
*   `@@index([userId])`: Otimiza buscas de histórico de sessões anteriores associadas a um usuário específico.
*   `@@index([expiresAt])`: Fundamental para a performance de rotinas em lote (cron jobs) que buscam e limpam sessões que expiraram no tempo.
*   `@@index([userId, sessionId])`: Index composto que acelera a verificação de integridade caso o backend decida validar a associação de um usuário logado ao respectivo ID de sessão.

---

## 4. Proposta de Arquitetura de Código Futura

Para preservar as regras de baixo acoplamento descritas em [docs/ARCHITECTURE.md](file:///Users/douglasoliveira/Desktop/RotaBus-API/docs/ARCHITECTURE.md), a transição deve seguir o padrão de inversão de dependências.

### 4.1 Abstração via Repository: `conversationSession.repository.js`
Será criada uma camada de repositório para encapsular todas as interações do Prisma Client. A interface exposta conterá os métodos:
```javascript
// Exemplo de assinatura conceitual
async function create({ sessionId, userId, initialState, context, expiresAt }) { ... }
async function findBySessionId(sessionId) { ... }
async function update(sessionId, data) { ... }
async function deleteBySessionId(sessionId) { ... }
async function deleteExpired(now) { ... }
```

### 4.2 Adaptação de `session.manager.js`
O [session.manager.js](file:///Users/douglasoliveira/Desktop/RotaBus-API/backend/src/modules/journeys/dialog/session.manager.js) deixará de manipular diretamente o `Map` interno em memória e passará a chamar o repositório assincronamente. Como o acesso ao banco é assíncrono, os métodos do `session.manager.js` passarão a retornar `Promise`.

### 4.3 Interface Híbrida para Permutabilidade (Memória / PostgreSQL)
Para viabilizar testes unitários e de integração rápidos offline, o `SessionManager` utilizará um padrão de injeção/alternância de driver com base em variáveis de ambiente (ex: `PERSISTENCE_DRIVER=postgres|memory`).

Estrutura de interface conceitual proposta para o `SessionManager`:
```javascript
const memoryDriver = require("./drivers/memory.driver");
const postgresDriver = require("./drivers/postgres.driver");

const driver = process.env.PERSISTENCE_DRIVER === "postgres" ? postgresDriver : memoryDriver;

async function getSession({ userId, sessionId }) {
  return driver.getSession({ userId, sessionId });
}
// Repetir assinatura abstrata para createSession, updateSession e deleteSession
```

### 4.4 Estratégia de Fallback para Testes
*   **Testes Unitários:** O ambiente de testes configurará `PERSISTENCE_DRIVER=memory` por padrão em `.env.test`. Isso impede que testes unitários exijam conexões reais de banco de dados, mantendo-os isolados e rápidos.
*   **Testes de Integração/E2E:** Rodarão com `PERSISTENCE_DRIVER=postgres`, conectando ao banco de dados de testes e utilizando hooks `beforeEach`/`afterEach` para rodar `prisma.conversationSession.deleteMany()` a fim de limpar o ambiente entre cada cenário de teste.

### 4.5 Gerenciamento do Ciclo de Vida da Sessão

#### Limpeza de Sessões Expiradas
Diferente da memória local, as sessões em PostgreSQL não desaparecem por si só. Propõe-se:
1. Um método no repositório: `deleteExpiredSessions()`.
2. Um processo periódico de limpeza rodando no servidor backend através de um agendador interno leve (ex: `node-cron` a cada 5 minutos) executando:
   ```javascript
   async function cronClearSessions() {
     const cleared = await conversationSessionRepository.deleteExpired(new Date());
     console.log(`[Cron] Limpeza de sessões: ${cleared} sessões expiradas removidas.`);
   }
   ```
3. Alternativamente, a limpeza pode ser agendada via trigger nativa no PostgreSQL ou rotina serverless do Supabase para reduzir carga de concorrência do servidor de aplicação.

#### Encerramento da Sessão no Comando `CANCEL`
Quando o usuário envia o comando `CANCEL`, o [conversation-command.handler.js](file:///Users/douglasoliveira/Desktop/RotaBus-API/backend/src/modules/journeys/dialog/conversation-command.handler.js) chama o método de remoção. 
Adotaremos a **deleção física** (`deleteSession`) para sessões de usuários anônimos para evitar inchaço do banco, e a **deleção lógica** (atualizar `endedAt` com o timestamp atual e manter `expiresAt` expirado) para usuários logados, preservando os metadados para fins analíticos de BI no futuro.

#### Renovação do `expiresAt` em Ações
Em chamadas normais de API, comandos `REPEAT` ou tráfego contínuo de mensagens, o método `getSession` calculará o novo vencimento adicionando 10 minutos (`Date.now() + DEFAULT_TTL_MS`) e disparará um update no banco de dados. Isso atualiza o Sliding TTL de forma transparente.

---

## 5. Plano de Implementação Futura

O desenvolvimento da persistência durável será segmentado em tarefas incrementais e isoladas por branches de desenvolvimento para mitigar riscos de regressão no Core:

1. **Branch 1: `migration/model-prisma-sessao`**
   - Modificar o `schema.prisma`.
   - Gerar a nova migration do Prisma localmente em ambiente de desenvolvimento usando `npx prisma migrate dev` (uso restrito a local/desenvolvimento).
   - Aplicar no banco de homologação/produção e validar o schema no Supabase usando o comando de deploy `npx prisma migrate deploy` (nunca rodar `migrate dev` em ambiente de produção).
2. **Branch 2: `feat/repository-sessao`**
   - Criar o arquivo `conversationSession.repository.js`.
   - Implementar métodos de CRUD no banco.
   - Criar testes unitários focados nas operações do repositório (com Mock do Prisma).
3. **Branch 3: `feat/session-manager-persistente`**
   - Refatorar o `session.manager.js` para suportar fluxo assíncrono (`async/await`).
   - Criar os adaptadores de driver (memória e postgres).
   - Implementar o job/cron de limpeza de sessões expiradas.
4. **Branch 4: `feat/integracao-command-controller`**
   - Ajustar o `journeys.controller.js` e o `conversation-command.handler.js` para consumir os métodos assíncronos do `SessionManager`.
   - Garantir retrocompatibilidade de payload e testes da API principal.
5. **Branch 5: `test/testes-sessao-persistente`**
   - Escrever testes unitários e de integração específicos cobrindo cenários com banco ativo e concorrência de expiração.
6. **Branch 6: `docs/documentacao-final-sessao`**
   - Atualizar a documentação do sistema indicando o fim da transição, novas variáveis de ambiente e atualizações no diagrama de infraestrutura.

---

## 6. Riscos Remanescentes e Mitigação

A migração de memória para banco apresenta alguns desafios de borda:
1. **Aumento de Latência por Acesso a Rede:** Cada chamada conversacional agora exigirá no mínimo uma consulta `SELECT` e uma escrita/atualização `UPDATE` no PostgreSQL.
   - *Mitigação:* As chaves de consulta estarão fortemente indexadas (`sessionId` e `userId`). As transações serão otimizadas para processarem concorrentemente e de forma assíncrona onde possível.
2. **Concorrência de Acesso à Mesma Sessão:** Se o usuário disparar requisições em paralelo muito rápido (ex: cliques seguidos de voz), pode haver concorrência de escrita na tabela.
   - *Mitigação:* Usar controle de transação otimista no Prisma ou adotar locks de registro se for detectada anomalia na FSM em ambiente de homologação.
3. **Inchaço de Dados por Sessões Órfãs:** Se o Cron de limpeza falhar, o banco crescerá indefinidamente com sessões abandonadas.
   - *Mitigação:* O índice em `expiresAt` garante queries rápidas. Alertas de monitoramento de volumetria da tabela serão adicionados ao dashboard do Supabase.
