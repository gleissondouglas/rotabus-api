# Roadmap e Evolução

O Nuvem nasceu como um app de rotas reativo e segue sua trajetória acelerada para o conceito de Assistente Proativo de Voz (Voice-First). Abaixo está o estado atual e o planejamento futuro.

## Fase 1: MVP Reactivo Inicial (✅ Concluído)
* Roteamento utilizando Google Routes puro.
* Transcrição TTS simplista isolada.
* O comando de voz era feito, porém em formato imperativo rígido ("Quero ir para X").

## Fase 2: Motor Conversacional Base (✅ Concluído)
* Criação do `SessionManager` e da `ConversationSession`.
* Migração de um comando unitário para fluxos estruturados (`POST /journeys/command`).
* Implementação do frontend React Native renderizando o payload JSON SDUI (Server-Driven UI).
* Mapeamento da camada Determinística Local (`LocalIntelligence`).

## Fase 3: Maturidade de Backend (✅ Concluído)
* Injeção de Proteção Financeira e Rate Limiters.
* Injeção do Zod Validator global.
* Migração da persistência FSM (Sessão) do Map (memória ram) para o Postgres (tolerante à falha em infraestrutura distribuída).
* Expansão da Resposta Conversacional com a integração `conversational.mapper.js`.

## Fase 4: Refinamento de Frontend Voice Loop (🚧 Em Andamento)
* Ajuste no STT e TTS para aguardar a Promise de Finalização de Áudio (`speakAndWait`), sanando o loop infinito de gravação ruidosa.
* Aplicação rigorosa dos comandos de Voice-Intent determinísticos ("Sim", "A Primeira").
* UI de falha caso permissão de microfone não seja dada (Fallback puro-visual).
* Implementar navegação visual completa de rotas em blocos ("RouteStep") a partir da confirmação final do assistente.

## Fase 5: Inteligência Aprimorada (🔮 Planejado / Backlog)
1. **Cache Local Interativo (Offline-first parciais):** Salvar itinerários frequentes (Ida p/ Casa) offline.
2. **Contextualização com LLMs:** Conectar via adapter o GPT-4o-mini apenas no `VoiceIntentParser` do backend quando as heurísticas locais determinísticas falharem ("Me leve pro mesmo lugar de ontem" ou frases emboladas cheias de maneirismos locais complexos).
3. **Proatividade e Notificações (Push):** Utilizar Expo Notifications Push. Ex: "Você está perto do ponto do ônibus 100, ele passa em 5 min. Quer que eu te guie pra lá?".
4. **Administração Dinâmica (Painel):** Um CMS interno/Web-App que possibilite à gerência injetar aliases novos no banco de dados (`LocalIntelligence`), sem necessidade de dar commit/deploy do backend.
