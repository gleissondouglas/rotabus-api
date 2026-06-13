# Arquitetura do Projeto: Nuvem (RotaBus-API)

Este documento descreve a estrutura técnica do sistema Nuvem, detalhando sua organização atual, os princípios que guiam o desenvolvimento e a visão de evolução para uma arquitetura de assistente de mobilidade voice-first.

---

## 1. Princípios Arquiteturais do Nuvem

Para garantir a sustentabilidade e a qualidade do projeto, adotamos os seguintes princípios:

*   **Independência de Ferramentas:** As regras de negócio centrais não devem depender diretamente de ferramentas externas (Google Routes, Prisma, Speech API, etc.).
*   **Responsabilidade dos Controllers:** Controllers devem apenas lidar com a entrada/saída HTTP e delegar a execução para a camada de serviço. Não devem conter lógica de negócio.
*   **Isolamento de Detalhes HTTP:** Services (ou Casos de Uso) não devem conhecer detalhes do protocolo HTTP (como objetos `req` ou `res`).
*   **Abstração via Contratos:** APIs externas e banco de dados devem ser isolados por "Providers" ou "Adapters", protegendo o núcleo do sistema de mudanças nessas ferramentas.
*   **Divisão de Papéis Frontend/Backend:**
    *   **Frontend:** Focado na experiência visual, captura de áudio, reprodução de fala, gerenciamento de permissões e acessibilidade.
    *   **Backend:** Focado na orquestração do fluxo, regras de negócio, gerenciamento do estado conversacional e decisões de navegação.
*   **Evolução Gradual:** A arquitetura deve evoluir de forma incremental, evitando reescritas totais e priorizando refatorações cirúrgicas.

---

## 2. Visão da Arquitetura

### 2.1 Estado Atual: Monólito Modular em Camadas
O sistema está organizado em módulos funcionais (`auth`, `users`, `journeys`), onde cada módulo segue uma estrutura de camadas:
1.  **Routes:** Define os pontos de entrada.
2.  **Controllers:** Valida e orquestra a requisição.
3.  **Services:** Contém a lógica de orquestração da jornada.
4.  **Repositories/Providers:** Realizam a comunicação com o Prisma ou APIs do Google.

*Status:* Funcional e organizado, mas com lógica de negócio ainda muito acoplada aos formatos de resposta do Google.

### 2.2 Arquitetura de Transição
O estágio imediato de evolução foca em:
*   **Desacoplamento de Mappers:** Extrair a lógica do `journey.mapper.js` para utilitários independentes.
*   **Definição de Contratos:** Padronizar como os Services chamam os Providers usando interfaces conceituais em JavaScript (CommonJS).
*   **Exemplos de Contratos de Providers:**
    *   `routeProvider.computeTransitRoute(origin, destination, options)`
    *   `placesProvider.resolveDestination(text, origin)`
    *   `speechProvider.transcribe(audioBuffer/base64)`

### 2.3 Arquitetura Alvo: Clean Architecture / Hexagonal
A visão futura é transformar o backend em um núcleo (Core) protegido, onde:
*   **Domain:** Contém entidades puras de mobilidade e regras de diálogo.
*   **Application (Use Cases):** Implementa fluxos como `PlanJourney` ou `ProcessUserSpeech`.
*   **Infrastructure (Adapters):** Camada externa que implementa os contratos definidos pelo Core (Prisma, Google SDKs).
*   **Dialog Manager:** Componente central para gerenciar a sessão e o estado da conversa.

---

## 3. O Papel do Frontend no Modelo Voice-First

No ecossistema Nuvem, o frontend não é apenas uma interface visual, mas o terminal de interação sensorial do usuário:

*   **Captura e Pré-processamento:** Gerencia o microfone e a qualidade do áudio enviado.
*   **Reprodução (TTS):** Transforma as respostas de texto do backend em fala fluida.
*   **Renderização Dinâmica:** Exibe informações baseadas nas instruções do backend (`displayData`).
*   **Acessibilidade Ativa:** Aplica Haptics (vibração) e sons de feedback para confirmar ações.
*   **Fluxo Orientado pelo Backend:** O frontend envia eventos (voz capturada, clique em opção) e reage às instruções estruturadas do backend.

---

## 4. Fluxo de Dados: Atual vs. Futuro

### 4.1 Fluxo Atual (Comando Único)
1.  **Usuário:** Informa destino por voz ou texto.
2.  **Backend:** Resolve o local geograficamente.
3.  **Backend:** Calcula a melhor rota de ônibus/caminhada.
4.  **Frontend:** Exibe o mapa e a lista de passos.

### 4.2 Fluxo Futuro (Conversacional Voice-First)
1.  **Usuário:** Inicia conversa com o assistente ("Quero ir ao médico").
2.  **Backend (NLU/Intent Detection):** Identifica a intenção de viagem.
3.  **Backend (Dialog Manager):** Identifica que precisa de mais informações (Qual médico?).
4.  **Backend (Response):** Retorna JSON estruturado:
    *   `speechText`: "Encontrei três clínicas próximas. Qual delas você prefere?"
    *   `displayData`: Lista visual das clínicas.
    *   `options`: ["Clínica A", "Clínica B", "Clínica C"].
    *   `nextExpectedInput`: `VOICE_OR_TOUCH`.
5.  **Frontend:** Fala a pergunta, mostra as opções e aguarda a próxima entrada.

---

## 5. Possibilidades de Evolução (Módulos Sugeridos)

Estes módulos não são obrigatórios de imediato, mas representam o caminho natural de crescimento:

*   **`modules/conversation`:** Gerenciamento de `ConversationSession` e histórico de interações recentes.
*   **`modules/intelligence`:** Abstração de regras regionais (`LocalIntelligence`), detecção de intenção e normalização de linguagem.
*   **`modules/shared/contracts`:** Definição clara dos contratos que todos os providers devem seguir.

---

## 6. Riscos Arquiteturais

1.  **Sincronismo de Estado:** Garantir que o "estado da conversa" no backend seja refletido corretamente na UI do frontend.
2.  **Performance:** Manter o tempo de resposta (latência) baixo o suficiente para uma conversa natural.
3.  **Complexidade de Abstração:** Evitar criar camadas desnecessárias que dificultem a depuração sem trazer benefícios reais de desacoplamento.

---
*Documento de referência para o design e evolução técnica do Nuvem.*
