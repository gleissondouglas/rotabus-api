# Domínio e Regras de Negócio

O Domínio do projeto concentra as regras vitais para que o aplicativo opere corretamente sem depender da UI (Frontend) ou do Banco de Dados (Prisma). As regras de domínio garantem o fluxo correto do Assistente de Voz.

## 1. O Motor de Estado Conversacional (Dialog Manager FSM)

O coração do domínio é a máquina de estados finitos (Finite State Machine - FSM) gerida pelo `Dialog Manager`. Toda conversa de voz passa por ele.

### 1.1 Estados Possíveis da Sessão (ConversationState)

- `IDLE`: Estado inicial. O usuário acabou de abrir o aplicativo ou cancelou um fluxo.
- `WAITING_DESTINATION`: O assistente perguntou "Para onde vamos?" e aguarda um destino.
- `WAITING_CONFIRMATION`: O sistema encontrou **um** único local (ex: "Hospital Mário Palmério") e aguarda um "Sim" ou "Não" (Confirmar).
- `WAITING_DESTINATION_SELECTION`: O sistema encontrou **múltiplos** locais parecidos. O assistente lê as opções e aguarda a seleção ("Primeira", "Segunda", etc).
- `JOURNEY_DISPLAYED`: O trajeto foi calculado e está na tela. A navegação foi iniciada.
- `ERROR`: Estado global de exceção tratada.

### 1.2 Eventos (Ações e Comandos)

O usuário ou o sistema emitem eventos que forçam a FSM a mudar de estado:

- `START_SESSION`: Iniciou o diálogo. Transita para `WAITING_DESTINATION`.
- `DESTINATION_RESOLVED`: Destino encontrado perfeitamente. Vai para `WAITING_CONFIRMATION`.
- `DESTINATION_AMBIGUOUS`: Diversos locais encontrados. Vai para `WAITING_DESTINATION_SELECTION`.
- `CONFIRM`: Comando de Voz ("Sim") ou botão de UI pressionado. Avança fluxo.
- `SELECT_OPTION`: Comando de Voz ("A primeira") ou UI (toque num item).
- `REPEAT`: Solicita ao sistema que reenvie a última mensagem `speechText` e não mude o estado.
- `CANCEL`: Encerra o fluxo atual. Limpa a sessão. Transita para `IDLE`.

## 2. Regras de Inteligência Local (Local Intelligence)

Para garantir resiliência e evitar custos excessivos de chamadas geográficas, o Nuvem implementa regras de negócio fixas no módulo `LocalIntelligence`:

* **Sinônimos e Apelidos (Aliases):** O módulo substitui termos coloquiais ("UPA") por nomes oficiais de busca ("UPA Uberaba", ou um local predefinido). 
* **Regras Estritas:** Reduz a incerteza antes de acionar a IA ou APIs do Google.

## 3. Casos de Uso (Use Cases)

1. **Resolver Destino (`ResolveDestinationUseCase`):**
   - Recebe um texto falado (transcrito) ou digitado.
   - Aplica `LocalIntelligence`.
   - Consulta Google Places se necessário.
   - Determina se o retorno é ambíguo (múltiplas opções) ou exato.
   - Emite o evento `DESTINATION_RESOLVED` ou `DESTINATION_AMBIGUOUS`.

2. **Planejar Jornada (`PlanJourneyUseCase`):**
   - Recebe um local confirmado.
   - Invoca provedor de rotas (Google Routes).
   - Calcula trajeto misto de Ônibus + Caminhada.
   - Avalia a preferência de horário (Departure/Arrival time).
   - Exceção: Se não houver rotas disponíveis, lança `RouteNotFoundError`.

3. **Gerenciar Comando Conversacional (`ConversationCommandHandler`):**
   - Valida se o comando existe (`CONFIRM`, `CANCEL`, `SELECT_OPTION`).
   - Confirma que o estado atual permite o comando (Ex: Rejeitar um `CONFIRM` quando se está em `IDLE`).

## 4. Sessão e TTL (Time to Live)

- Uma `ConversationSession` é criada assim que um diálogo é iniciado e mantida ativa sob o par `userId` e `sessionId`.
- **Sliding TTL:** A sessão expira após 10 minutos (padrão) de inatividade. Qualquer comando ou interação reseta o temporizador de volta a 10 minutos.
- A persistência deste domínio utiliza o driver ativo (`memory` ou `postgres`).

## 5. Regras de Proteção Financeira (Rate Limiting e Limite Diário)

- **Daily Journey Limit:** O sistema possui um limite restrito ("Budgeting") onde um usuário autenticado só pode requisitar o provedor de cálculo de rotas no máximo `X` vezes ao dia (geralmente fixado em 10).
- Contabilização: Uma entrada na tabela `ApiUsage` é criada somente quando o Google Routes é chamado (cache hits não contam).
- Falha: Ao estourar o limite, o domínio emite a exceção `DailyLimitExceededError` impedindo custos e notificando o usuário.

## 6. Exceções e Erros de Domínio

- `DailyLimitExceededError`: O usuário excedeu as rotas.
- `InvalidStateTransitionError`: FSM intercepta um comando absurdo para o contexto (Ex: `SELECT_OPTION` quando não há opções).
- `SessionExpiredError`: O TTL da conversa se esgotou; a interação deve recomeçar.
- `DestinationNotFoundError`: Google Places não encontrou localidade.
- `RouteNotFoundError`: Impossível traçar transporte público entre origem e destino (normalmente quando a distância é irreal ou horários indisponíveis).
