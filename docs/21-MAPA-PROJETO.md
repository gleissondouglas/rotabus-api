# Mapa do Projeto e Árvore de Diretórios

Esta seção cumpre o papel de "Raio-X" da arquitetura de pastas. Um Desenvolvedor consegue varrer visualmente este mapa e encontrar com precisão os artefatos desejados.

## 1. Visão Global

```text
/RotaBus-API
│
├── backend/               # Motor de estado, rotas, regras de negócio (API Node)
├── frontend/              # Aplicativo Expo/React Native (UI, Telas, Integrações Nativas)
└── docs/                  # Dossiê técnico de engenharia de software e projeto (Markdown)
```

## 2. Mapa do Backend (`/backend/src/`)

```text
backend/src/
│
├── modules/                         # Lógica dividida por Domínio/Feature (Silos isolados)
│   ├── auth/                        # Gerenciamento de Login e Recuperação de Senha
│   ├── journeys/                    # Domínio Central: Onde mora o Assistente de Voz
│   │   ├── dialog/                  # O coração do motor FSM e das Sessões (DialogManager)
│   │   ├── local-intelligence/      # Aliases e regras hardcoded de apelidos de localidades (ex: "Centro")
│   │   ├── providers/               # Isolamento de chamadas a serviços Google (Places, Routes)
│   │   └── utils/                   # Mappers e Helpers focados exclusividade do Domínio
│   │       ├── conversational.mapper.js # Transforma rotas do Google no contrato estruturado de SDUI Voz
│   │       └── instruction-builder.js   # Gera strings sumarizadas e legíveis da rota final para o TTS ler.
│   │
│   └── users/                       # CRUD, Perfis de Conta, Deleção de LGPD
│
├── shared/                          # Ferramentas globais comuns a todos os Módulos
│   ├── middlewares/                 # Catracas de acesso (RateLimiter, AuthValidator, GlobalError)
│   ├── providers/                   # Provedores base como Hash bcrypt e Autenticadores
│   ├── repositories/                # Camada de Comunicação com Prisma e BD Global
│   └── utils/                       # Utilitários globais genéricos (Datas, Formatters)
│
├── server.js                        # Ponto de Entrada (Entrypoint). Instancia Express, invoca Rotas e Listen.
└── prisma/
    └── schema.prisma                # Definição canônica do Banco de Dados PostgreSQL.
```

**Arquivos de Alta Criticidade (Backend):**
- `backend/src/modules/journeys/dialog/dialog.manager.js`: A Máquina de Estados que faz o assistente de voz funcionar por trás dos panos.
- `backend/src/modules/journeys/utils/conversational.mapper.js`: Decorator que dita o formato estrito de comunicação que o App do celular precisará ingerir.

---

## 3. Mapa do Frontend (`/frontend/`)

```text
frontend/
│
├── app/                             # O Sistema de Navegação Nativa do Expo Router
│   ├── _layout.tsx                  # Base de UI (Headers genéricos e Context Providers globais)
│   ├── index.tsx                    # Ponto zero. Decide se redireciona pro onboarding ou pro mapa
│   ├── inicio.tsx                   # A tela sagrada (Homescreen). Onde o botão central da assistente mora.
│   ├── confirmar-destino.tsx        # UI Genérica Server-driven (Exibe a sugestão enviada pela Voz do Backend)
│   └── melhor-rota.tsx              # Tela robusta que exibe o polyline do Google Maps no dispositivo
│
├── src/                             # Lógicas Isoladas da View do Router
│   ├── components/                  # (UI) Peças Reutilizáveis (Cards, Botões Grandes)
│   │   ├── LiveTranscript.tsx       # Visor em tempo real do STT pro Usuário
│   │   ├── RouteStep.tsx            # Peça da UI que renderiza passo-a-passo da jornada
│   │   └── VoiceOrb.tsx             # Elemento dinâmico de pulsar do microfone
│   │
│   ├── config/                      # Constantes de Setup Globais da aplicação e chaves
│   ├── contexts/                    # Contextos (React Context) Globais compartilhados
│   │
│   ├── hooks/                       # Engrenagens Lógicas Assíncronas (React Hooks custom)
│   │   └── useVoiceConversationLoop.ts # O Maestro do Áudio: Coordena TTS -> Pausa -> Mic
│   │
│   ├── services/                    # Wrappers que emulam a camada de "API Client"
│   │   ├── api.ts                   # Instância global do Axios anexando o Token
│   │   ├── journey.service.ts       # Dispara os requests conversacionais pro Backend Node
│   │   └── speech.service.ts        # Gerenciador de Áudio com a promessa essencial de Pausa-Escuta
│   │
│   ├── theme/                       # Design System, Tokens de cor de acessibilidade
│   └── utils/                       # Helpers (Parser de Intenção, formatadores geográficos)
│       └── voiceIntentParser.ts     # Filtro local anti-LLM para limpar "Sim/Não/1/2" determinístico.
│
├── app.config.js                    # Manifesto de Setup do Aplicativo (Versões, Pacotes Nativos)
└── eas.json                         # Configurações de compilação remota do Expo Application Service.
```

**Arquivos de Alta Criticidade (Frontend):**
- `frontend/src/hooks/useVoiceConversationLoop.ts`: Se este arquivo falhar, o loop microfone/boca quebra e entra em retroalimentação infinita. Toda cautela em atualizações assíncronas de hooks deve focar neste script.
- `frontend/src/services/speech.service.ts`: Abstração sensível dependente dos SOs e aparelhos, encapsulando falhas nativas.
