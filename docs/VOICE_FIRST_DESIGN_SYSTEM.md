# Design System Voice-First: Nuvem

Este documento define a identidade visual, a arquitetura de UX e o catálogo de componentes reutilizáveis do app Nuvem, orientando toda implementação futura de interface. Nenhuma implementação de código é definida aqui como concluída — este é o documento de referência oficial para as branches de implementação.

> [!IMPORTANT]
> **Princípio fundador do produto:**
> "O Nuvem é um app conversacional com apoio visual."
> A voz é o fluxo principal. A tela reforça visualmente o estado da conversa. O toque e a digitação continuam como fallback acessível.

---

## 1. Filosofia de Design

### 1.1 Conversa, não formulário

O app não deve parecer um conjunto de telas/formulários desconectados. Toda tela deve transmitir a sensação de uma conversa contínua com apoio visual. O usuário está conversando com a assistente Nuvem, e a interface é a "expressão visual" dessa conversa.

### 1.2 Voice-First, não Voice-Only

A voz é o canal principal. Toque e digitação são fallbacks acessíveis que nunca devem ser bloqueados ou prejudicados pela interface de voz. Ambos os modos acionam os mesmos handlers e resultam nos mesmos estados.

### 1.3 Minimalismo funcional

Cada elemento na tela deve ter um propósito claro. Sem decoração gratuita, sem excesso de informação. A interface deve ser limpa, leve e rápida de ler — tanto por olhos humanos quanto por leitores de tela.

---

## 2. Estrutura Visual Única

A maioria das telas do app deve seguir uma estrutura base consistente, composta por cinco camadas empilhadas verticalmente:

```
┌─────────────────────────────┐
│  Topo simples               │  ← Header mínimo (opcional: título, botão voltar)
├─────────────────────────────┤
│                             │
│  Animação Assistente / Orb  │  ← VoiceOrb: muda tamanho e posição conforme modo
│                             │
├─────────────────────────────┤
│                             │
│  Área de texto / conteúdo   │  ← ConversationText, cards, carrossel, etc.
│                             │
├─────────────────────────────┤
│  Botões fixos (bottom bar)  │  ← BottomActionBar: primário, secundário, terciário
└─────────────────────────────┘
```

Essa estrutura é implementada pelo componente `VoiceScreenLayout` e adaptada por dois modos de layout.

---

## 3. Modos de Layout

### 3.1 Modo Conversa

Usado quando o app está **falando**, **ouvindo**, **processando** ou **perguntando** algo ao usuário.

Características visuais:
* A animação `VoiceOrb` fica **grande** no centro ou centro-superior da tela.
* O texto da assistente aparece em destaque abaixo/acima do orb.
* O texto falado ou digitado pelo usuário aparece abaixo, com estilo diferenciado.
* Palavras podem aparecer com **transição suave** (fade-in sequencial).
* A palavra/frase atual pode ficar em **destaque** (cor primária, peso maior).
* Frases antigas podem **subir**, **perder opacidade** ou **desaparecer** para economizar espaço.
* Botões ficam **fixos na parte inferior**.

```
┌───────────────────────┐
│     (header leve)     │
│                       │
│     ╭───────────╮     │
│     │           │     │
│     │  ● ORB ●  │     │  ← Grande, animado, centralizado
│     │           │     │
│     ╰───────────╯     │
│                       │
│  "Encontrei Praça     │  ← Texto da assistente (destaque)
│   Rui Barbosa.        │
│   É esse o lugar?"    │
│                       │
│  "sim"                │  ← Texto do usuário (secundário)
│                       │
│  ┌─────────────────┐  │
│  │  Confirmar ✓    │  │  ← Botão primário
│  │  Outro destino  │  │  ← Botão secundário
│  │  Ouvir destino  │  │  ← Link terciário
│  └─────────────────┘  │
└───────────────────────┘
```

### 3.2 Modo Resultado / Escolha

Usado quando o app encontrou destino, múltiplas opções, rota ou precisa que o usuário escolha algo.

Características visuais:
* A animação **sobe para o topo** da tela.
* A animação **diminui de tamanho** (ex: de 120px para 48–56px).
* A animação continua **viva** (pulsando suavemente), mas deixa o conteúdo ser protagonista.
* A **área central** passa a exibir **cards translúcidos**.
* Os cards devem parecer leves, translúcidos, com visual de vidro/plástico/filme.
* A interface não deve destoar do tom da página.

```
┌───────────────────────┐
│  (header)  ● orb ●    │  ← Orb pequeno, no topo
│                       │
│  ┌─────────────────┐  │
│  │  ╔═══════════╗  │  │
│  │  ║ Card 1    ║  │  │  ← Cards translúcidos
│  │  ║ destino   ║  │  │
│  │  ╚═══════════╝  │  │
│  │                  │  │
│  │  ╔═══════════╗  │  │
│  │  ║ Card 2    ║  │  │
│  │  ╚═══════════╝  │  │
│  └─────────────────┘  │
│                       │
│  ┌─────────────────┐  │
│  │  Confirmar ✓    │  │
│  │  Outro destino  │  │
│  │  Ouvir opções   │  │
│  └─────────────────┘  │
└───────────────────────┘
```

---

## 4. Animação do Assistente (VoiceOrb / AssistantOrb)

### 4.1 Componente atual

O projeto já possui `VoiceOrb.tsx` em `frontend/src/components/` com estados `idle`, `listening`, `processing` e `error`, usando `react-native-reanimated`. O redesign deve **evoluir** este componente, não descartá-lo.

### 4.2 Estados visuais do orb

| Estado | Animação | Tamanho | Cor | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `idle` | Pulso lento e suave | Grande (120px) | Azul primário | Aguardando início de interação |
| `speaking` | Ondulação rítmica | Grande (120px) | Azul primário | Assistente está falando via TTS |
| `listening` | Pulso expansivo + anéis | Grande (120px) | Azul primário brilhante | Microfone aberto, captando fala |
| `processing` | Rotação suave + shimmer | Grande (120px) | Azul primário | Processando transcrição ou resposta |
| `showing_result` | Pulso sutil | Pequeno (48px) | Azul primário atenuado | Resultado exibido, orb no topo |
| `awaiting_confirmation` | Pulso médio + glow | Grande (100px) | Azul primário | Esperando "sim" ou "não" do usuário |
| `error` | Tremor curto | Grande (120px) | Vermelho (danger) | Erro de STT, permissão ou rede |
| `manual_mode` | Estático ou pulso mínimo | Pequeno (48px) | Cinza atenuado | Usuário interagindo por toque/digitação |

### 4.3 Comportamento de transição entre modos

* **Conversa → Resultado:** Orb anima suavemente para o topo, diminuindo de tamanho com `withSpring`. Cards surgem com `FadeIn` de baixo para cima.
* **Resultado → Conversa:** Cards saem com `FadeOut`, orb volta ao centro e cresce.
* **Qualquer → Erro:** Orb pulsa em vermelho 1–2 vezes e volta ao estado anterior ou `idle`.

### 4.4 Feedback de escuta

Quando o estado é `listening` (aguardando resposta do usuário):
* O orb deve expandir suavemente com anéis pulsantes (já implementado em `PulseRing`).
* Deve haver **texto indicativo** claro abaixo do orb:
  * `"Estou ouvindo sua resposta..."` (genérico)
  * `"Diga 'sim' para confirmar ou 'não' para escolher outro destino."` (contextual)
* O componente `VoiceListeningHint` é responsável por esse texto.

### 4.5 Comportamento ao encontrar resultados

* A animação sobe para o topo com `withSpring` (damping: 15, stiffness: 100).
* Diminui de ~120px para ~48px.
* Continua com pulso lento e sutil para transmitir "estou aqui, ativa".
* O conteúdo (cards) é o protagonista — o orb é apenas contexto.

---

## 5. Cards Translúcidos (Glassmorphism)

### 5.1 Especificação visual

| Propriedade | Valor |
| :--- | :--- |
| `backgroundColor` | `rgba(255, 255, 255, 0.08)` (dark) / `rgba(255, 255, 255, 0.85)` (light) |
| `backdropFilter` / `blur` | `blur(16px)` — usar `@react-native-community/blur` ou `expo-blur` |
| `borderWidth` | `1px` |
| `borderColor` | `rgba(255, 255, 255, 0.12)` (dark) / `rgba(0, 0, 0, 0.06)` (light) |
| `borderRadius` | `20px` |
| `shadowColor` | `rgba(0, 0, 0, 0.15)` |
| `shadowOffset` | `{ width: 0, height: 8 }` |
| `shadowOpacity` | `0.1` |
| `shadowRadius` | `24` |
| `padding` | `20px` |

> [!NOTE]
> O `backdropFilter: blur()` não funciona nativamente no React Native em todas as plataformas. Para Android, usar `expo-blur` com `BlurView` como container ou simular com `backgroundColor` semi-transparente sobre fundo escuro. Documentar fallback no componente.

### 5.2 Usos do GlassResultCard

* Destino único encontrado
* Cada item do carrossel de múltiplas opções
* Resumo de rota
* Escolha de horário (chips de data/hora)
* Configurações e ajuda (opcional, se fizer sentido)

### 5.3 Conteúdo interno dos cards

Cada card deve respeitar uma hierarquia interna consistente:

```
┌─────────────────────────────┐
│  🏥 Ícone ou categoria      │  ← Opcional
│                             │
│  Hospital Mário Palmério    │  ← Título (bold, 18px)
│  Av. Nenê Sabino, 2000     │  ← Subtítulo (muted, 14px)
│  Uberaba - MG, 38050-501   │  ← Detalhe (muted, 13px)
│                             │
│  📍 2.3 km de distância     │  ← Metadado contextual (opcional)
└─────────────────────────────┘
```

---

## 6. Múltiplas Opções (Carrossel)

### 6.1 Comportamento visual

Quando o backend retorna múltiplos destinos:
* Exibir **carrossel horizontal** (`FlatList` horizontal ou `ScrollView` paginada).
* Permitir **arrastar** para os lados (swipe gesture).
* **Card central** em destaque: escala `1.0`, opacidade `1.0`.
* **Cards laterais** menores: escala `0.85–0.9`, opacidade `0.5–0.7`.
* Efeito simples de **paralaxe**: deslocamento leve de conteúdo interno ao scroll, sem exagero.
* Indicador de paginação (dots) abaixo do carrossel.

### 6.2 Interação

| Modo | Ação |
| :--- | :--- |
| Toque | Tocar no card para selecionar |
| Swipe | Arrastar para navegar entre opções |
| Voz | Dizer "primeira", "segunda", "terceira" |
| Voz | Dizer "não" ou "outro destino" para cancelar |
| Digitação | Digitar outro destino |

### 6.3 Após seleção

* Card selecionado pode **expandir** com animação (`withSpring`).
* Assistente pergunta: *"Você quer ir para este lugar?"*
* Fluxo segue para confirmação normal.

---

## 7. Destino Único

Quando houver só um destino:
* Mostrar um **card central** com nome e endereço completos.
* O fluxo por voz **deve mostrar os mesmos dados** do fluxo digitado.

> [!WARNING]
> **Regra de paridade de dados:** O card de destino único NÃO pode exibir apenas "Uberaba - MG" se o fluxo digitado mostra "Praça Rui Barbosa - Centro, Uberaba - MG, 38010-166". Deve preservar `name`, `formattedAddress`, `latitude`, `longitude` e demais dados completos do destino.

---

## 8. Botões Fixos (BottomActionBar)

### 8.1 Estrutura

A parte inferior de toda tela conversacional terá um componente fixo com até três ações:

| Nível | Componente | Estilo |
| :--- | :--- | :--- |
| Primário | `PrimaryActionButton` | Botão cheio, cor primária, texto bold, ícone opcional |
| Secundário | `SecondaryActionButton` | Botão outline ou ghost, cor neutra/sutil |
| Terciário | `TertiaryActionLink` | Link de texto simples, cor muted |

### 8.2 Mapeamento por tela

| Tela | Primário | Secundário | Terciário |
| :--- | :--- | :--- | :--- |
| Início | 🎙️ Falar agora | ⌨️ Digitar destino | ❓ Ajuda |
| Confirmação de destino | ✅ Confirmar destino / Buscar rota | 🔄 Escolher outro destino | 🔊 Ouvir destino |
| Múltiplas opções | ✅ Selecionar este | 🔄 Outro destino | 🔊 Ouvir opções |
| Escolha de horário | 🕐 Ir agora | 📅 Escolher horário | 🔊 Ouvir opções |
| Melhor rota | 🚀 Iniciar navegação | 📋 Ver detalhes | 🔊 Ouvir resumo |
| Navegação | 📍 Cheguei ao ponto | ⏹️ Parar navegação | 🔊 Ouvir caminho |

### 8.3 Componente visual

O `BottomActionBar` deve ser **um único componente** que recebe configuração de botões e renderiza consistentemente em qualquer tela. Ele fica fixo na parte inferior, acima do safe area.

---

## 9. Telas Voice-First e Voz Opcional

### 9.1 Telas voice-first prioritárias

Essas telas **podem abrir microfone automaticamente**, mas **somente após** a assistente terminar de falar (TTS completo):

* `inicio.tsx` — Saudação + escuta de destino
* `confirmar-destino.tsx` — Pergunta de confirmação + escuta de "sim"/"não"
* Múltiplas opções (dentro de `confirmar-destino.tsx`) — Leitura de opções + escuta de seleção
* `escolher-horario.tsx` — Pergunta de horário + escuta de resposta

### 9.2 Telas com voz opcional

Essas telas **não devem** abrir microfone automaticamente:

* `melhor-rota.tsx`
* `navegando.tsx`
* `chegada.tsx`
* `ajuda.tsx`
* `configuracoes.tsx`
* `login.tsx`
* `criar-conta.tsx`
* Termos de uso
* Política de privacidade

Nessas telas, a voz existe **por botão explícito**:
* 🔊 Ouvir resumo
* 🔊 Ouvir instrução
* 🎙️ Falar comando
* 🔁 Repetir

---

## 10. Tema Visual

### 10.1 Análise de opções

#### Opção A: Preto/Grafite + Branco + Azul de destaque

| Aspecto | Avaliação |
| :--- | :--- |
| **Prós** | Premium, moderno, contraste forte, faz o orb azul "brilhar", reduz fadiga visual em uso noturno/prolongado, padrão de apps conversacionais de referência (ChatGPT, assistentes de voz) |
| **Prós** | Combina naturalmente com glassmorphism — cards translúcidos sobre fundo escuro têm mais impacto visual |
| **Prós** | Economia de bateria em telas OLED |
| **Contras** | Pode dificultar leitura em ambientes muito iluminados (sol direto) |
| **Contras** | Exige atenção extra com contraste mínimo WCAG para textos secundários |
| **Mitigação** | Modo light como alternativa; alto contraste como opção de acessibilidade (já existe `highContrastDarkTheme`) |

#### Opção B: Azul/Branco atual refinado

| Aspecto | Avaliação |
| :--- | :--- |
| **Prós** | Familiar para usuários atuais, fácil legibilidade com luz solar direta |
| **Prós** | Menor risco de problemas de contraste |
| **Contras** | Visual mais "app genérico", menos diferenciado no mercado |
| **Contras** | Glassmorphism sobre fundo claro é mais sutil e menos impactante |
| **Contras** | Não reforça a identidade de "assistente conversacional" — parece formulário |

### 10.2 Decisão recomendada

> [!TIP]
> **Recomendação: Opção A (Preto/Grafite)** como tema padrão, mantendo o tema claro (Opção B refinada) como alternativa automática via `useColorScheme()`.

### 10.3 Paleta proposta (tema escuro — padrão)

| Token | Hex | Uso |
| :--- | :--- | :--- |
| `background` | `#0A0A0F` | Fundo principal da tela |
| `surface` | `#141420` | Fundo de áreas elevadas, modais |
| `card` | `rgba(255, 255, 255, 0.06)` | Fundo de cards translúcidos |
| `cardBorder` | `rgba(255, 255, 255, 0.10)` | Borda sutil de cards |
| `text` | `#F5F5F7` | Texto principal |
| `textSecondary` | `#8E8E93` | Texto secundário, labels, hints |
| `textMuted` | `#636366` | Texto terciário, timestamps |
| `primary` | `#3B82F6` | Ações, links, orb, destaques |
| `primaryGlow` | `rgba(59, 130, 246, 0.25)` | Glow do orb, shadows de destaque |
| `primaryLight` | `#60A5FA` | Hover/active sobre botões |
| `danger` | `#FF453A` | Erro, alerta crítico |
| `success` | `#30D158` | Confirmação, sucesso |
| `warning` | `#FFD60A` | Aviso |
| `divider` | `rgba(255, 255, 255, 0.08)` | Separadores |

### 10.4 Paleta proposta (tema claro — alternativo)

| Token | Hex | Uso |
| :--- | :--- | :--- |
| `background` | `#F8FAFF` | Fundo principal |
| `surface` | `#FFFFFF` | Cards e áreas elevadas |
| `card` | `rgba(255, 255, 255, 0.85)` | Cards translúcidos |
| `cardBorder` | `rgba(0, 0, 0, 0.06)` | Borda sutil |
| `text` | `#1C1C1E` | Texto principal |
| `textSecondary` | `#636366` | Texto secundário |
| `textMuted` | `#AEAEB2` | Texto terciário |
| `primary` | `#2563EB` | Ações e destaques |
| `primaryGlow` | `rgba(37, 99, 235, 0.15)` | Glow sutil |
| `danger` | `#EF4444` | Erro |
| `success` | `#10B981` | Sucesso |
| `warning` | `#F59E0B` | Aviso |
| `divider` | `rgba(0, 0, 0, 0.06)` | Separadores |

### 10.5 Tipografia

| Token | Valor | Uso |
| :--- | :--- | :--- |
| `fontFamily` | System default (San Francisco / Roboto) | Base — considerar Inter via expo-google-fonts em etapa futura |
| `heading` | `28–32px`, weight `800–900` | Títulos de tela |
| `subheading` | `18–20px`, weight `600–700` | Subtítulos e labels de seção |
| `body` | `16–17px`, weight `400–500` | Texto de conversa, corpo |
| `caption` | `13–14px`, weight `500` | Metadados, hints, timestamps |
| `button` | `17–18px`, weight `700–800` | Texto de botões |

### 10.6 Acessibilidade e alto contraste

O projeto já possui `highContrastDarkTheme` e `highContrastLightTheme` em `frontend/src/theme/colors.ts`. A nova paleta deve:

* Manter essas variantes.
* Garantir razão de contraste mínima **4.5:1** (WCAG AA) para textos normais.
* Garantir razão mínima **3:1** para textos grandes (≥18px bold).
* Todos os componentes devem usar `maxFontSizeMultiplier` para suportar fontes ampliadas.

---

## 11. Telas de Autenticação e Utilitárias

### 11.1 Layout de autenticação (AuthLayout)

As telas de login, cadastro e recuperação de senha compartilham um layout próprio, mais simples que o conversacional:

```
┌───────────────────────┐
│                       │
│     ☁️ Logo Nuvem     │  ← Logo + nome do app
│                       │
│  ┌─────────────────┐  │
│  │  Email           │  │  ← Campos de formulário
│  │  Senha           │  │
│  │                  │  │
│  │  [Entrar]        │  │  ← Botão primário
│  │                  │  │
│  │  ─── ou ───      │  │  ← Divisor
│  │                  │  │
│  │  [Google]        │  │  ← Login social
│  └─────────────────┘  │
│                       │
│  Criar conta          │  ← Link
│  Esqueci minha senha  │  ← Link
│                       │
│  Termos · Privacidade │  ← Rodapé com links legais
└───────────────────────┘
```

### 11.2 Tela de login

Campos e ações:
* Campo de email
* Campo de senha (com toggle de visibilidade)
* Botão primário: **Entrar**
* Divisor: "ou continue com"
* Botão social: **Continuar com Google**
* Link: **Criar conta**
* Link: **Esqueci minha senha**
* Rodapé: Links para **Termos de Uso** e **Política de Privacidade**

### 11.3 Tela de criar conta

* Campo de nome
* Campo de email
* Campo de senha
* Campo de confirmar senha
* Botão primário: **Criar conta**
* Botão social: **Continuar com Google**
* Link: **Já tenho uma conta**
* Checkbox ou texto: Concordo com os Termos de Uso

### 11.4 Tela de esqueci minha senha

* Campo de email
* Botão primário: **Enviar link de recuperação**
* Link: **Voltar para login**

### 11.5 Ajuda

* Lista de perguntas frequentes (FAQ) usando `SettingsList`
* Cada item expande com resposta
* Botão: **Falar com suporte** (link externo ou email)

### 11.6 Configurações

* Lista de opções usando `SettingsList`:
  * Alterar nome
  * Alterar senha
  * Acessibilidade (alto contraste, tamanho de fonte)
  * Sobre o app
  * Termos de Uso
  * Política de Privacidade
  * Sair

### 11.7 Telas legais (LegalTextScreen)

* Termos de Uso e Política de Privacidade compartilham o mesmo layout:
  * Header com título
  * Corpo de texto scrollável
  * Sem botões de ação (exceto voltar)

---

## 12. Catálogo de Componentes Reutilizáveis

### 12.1 VoiceScreenLayout

| Campo | Descrição |
| :--- | :--- |
| **Responsabilidade** | Layout principal de todas as telas conversacionais. Organiza header, orb, área de conteúdo e barra de ações. Gerencia a transição entre Modo Conversa e Modo Resultado. |
| **Props principais** | `mode: 'conversation' \| 'result'`, `headerTitle?: string`, `showBackButton?: boolean`, `children: ReactNode`, `bottomBar: BottomActionBarProps` |
| **Estados visuais** | Modo conversa (orb grande central), modo resultado (orb pequeno topo, conteúdo expandido) |
| **Telas que usam** | `inicio`, `confirmar-destino`, `escolher-horario`, `melhor-rota`, `navegando` |
| **Acessibilidade** | Respeita safe areas, suporta `maxFontSizeMultiplier`, compatível com leitores de tela |
| **Evolução** | Substitui gradualmente o `ScreenContainer` atual nas telas conversacionais; `ScreenContainer` continua para telas utilitárias |

### 12.2 AssistantOrb (VoiceOrb evoluído)

| Campo | Descrição |
| :--- | :--- |
| **Responsabilidade** | Animação visual que representa o estado da conversa. Evolução do `VoiceOrb.tsx` existente. |
| **Props principais** | `state: VoiceOrbState`, `size?: 'large' \| 'small'`, `onPress?: () => void` |
| **Estados visuais** | `idle`, `speaking`, `listening`, `processing`, `showing_result`, `awaiting_confirmation`, `error`, `manual_mode` |
| **Telas que usam** | Todas as telas conversacionais via `VoiceScreenLayout` |
| **Acessibilidade** | `accessibilityLabel` dinâmico por estado (ex: "Assistente ouvindo"), `accessibilityRole="image"` |
| **Observações** | Deve manter backward-compatibility com uso atual em telas que ainda não migraram |

### 12.3 ConversationText

| Campo | Descrição |
| :--- | :--- |
| **Responsabilidade** | Exibe o texto da assistente com transição suave. Palavra/frase atual em destaque. Textos anteriores perdem opacidade gradualmente. |
| **Props principais** | `text: string`, `highlightCurrent?: boolean`, `animationStyle?: 'fade' \| 'typewriter' \| 'none'` |
| **Estados visuais** | Texto aparecendo (animando), texto completo, texto saindo (fading) |
| **Telas que usam** | `inicio`, `confirmar-destino`, `escolher-horario` |
| **Acessibilidade** | Texto completo disponível para leitor de tela mesmo durante animação; `accessibilityLiveRegion="polite"` |

### 12.4 SpokenTranscript

| Campo | Descrição |
| :--- | :--- |
| **Responsabilidade** | Exibe o que o usuário disse (transcrição de voz) ou digitou. Estilo visual diferenciado do texto da assistente. |
| **Props principais** | `transcript: string`, `source: 'voice' \| 'typed'`, `isPartial?: boolean` |
| **Estados visuais** | Parcial (durante escuta, texto cinza), final (texto completo, cor secundária), erro (texto de fallback) |
| **Telas que usam** | `inicio`, `confirmar-destino`, `processando` |
| **Acessibilidade** | `accessibilityLabel="Você disse: {transcript}"` |

### 12.5 BottomActionBar

| Campo | Descrição |
| :--- | :--- |
| **Responsabilidade** | Container fixo na parte inferior com até 3 níveis de ação (primário, secundário, terciário). |
| **Props principais** | `primary: ActionButtonProps`, `secondary?: ActionButtonProps`, `tertiary?: ActionLinkProps` |
| **Estados visuais** | Normal, loading (qualquer botão), disabled |
| **Telas que usam** | Todas as telas conversacionais |
| **Acessibilidade** | Botões com `accessibilityRole="button"`, labels descritivos, `minHeight: 48px` em cada ação |

### 12.6 PrimaryActionButton

| Campo | Descrição |
| :--- | :--- |
| **Responsabilidade** | Botão de ação principal. Evolução do `PrimaryButton.tsx` existente. |
| **Props principais** | `title: string`, `onPress: () => void`, `icon?: string`, `isLoading?: boolean`, `disabled?: boolean` |
| **Estados visuais** | Default, pressed, loading, disabled |
| **Telas que usam** | Dentro de `BottomActionBar` em todas as telas |
| **Acessibilidade** | `accessibilityRole="button"`, `accessibilityLabel`, `minHeight: 64px` |

### 12.7 SecondaryActionButton

| Campo | Descrição |
| :--- | :--- |
| **Responsabilidade** | Botão de ação secundária. Estilo outline ou ghost. |
| **Props principais** | `title: string`, `onPress: () => void`, `icon?: string`, `isLoading?: boolean`, `disabled?: boolean` |
| **Estados visuais** | Default, pressed, loading, disabled |
| **Telas que usam** | Dentro de `BottomActionBar` |
| **Acessibilidade** | Mesmo padrão do primário |

### 12.8 TertiaryActionLink

| Campo | Descrição |
| :--- | :--- |
| **Responsabilidade** | Link de ação terciária. Estilo texto simples, sem fundo. |
| **Props principais** | `title: string`, `onPress: () => void`, `icon?: string` |
| **Estados visuais** | Default, pressed |
| **Telas que usam** | Dentro de `BottomActionBar` |
| **Acessibilidade** | `accessibilityRole="link"`, `accessibilityLabel` |

### 12.9 GlassResultCard

| Campo | Descrição |
| :--- | :--- |
| **Responsabilidade** | Card translúcido com glassmorphism para exibir resultados. |
| **Props principais** | `children: ReactNode`, `onPress?: () => void`, `selected?: boolean`, `style?: ViewStyle` |
| **Estados visuais** | Default, selected (borda primária + glow), pressed (escala 0.98) |
| **Telas que usam** | `confirmar-destino`, `escolher-horario`, `melhor-rota` |
| **Acessibilidade** | `accessibilityRole="button"` quando pressável, conteúdo acessível via children |
| **Observações** | Usar `expo-blur` com fallback para `backgroundColor` semi-transparente em Android |

### 12.10 DestinationCard

| Campo | Descrição |
| :--- | :--- |
| **Responsabilidade** | Card especializado de destino, composto sobre `GlassResultCard`. Exibe nome, endereço, categoria e distância. |
| **Props principais** | `name: string`, `formattedAddress: string`, `category?: string`, `distance?: string`, `onPress?: () => void`, `selected?: boolean` |
| **Estados visuais** | Default, selected, expanded (após seleção no carrossel) |
| **Telas que usam** | `confirmar-destino` (único e múltiplos) |
| **Acessibilidade** | `accessibilityLabel="{name}, {formattedAddress}"`, `accessibilityHint="Toque para selecionar este destino"` |

### 12.11 DestinationCarousel

| Campo | Descrição |
| :--- | :--- |
| **Responsabilidade** | Carrossel horizontal de destinos com paralaxe e paginação. |
| **Props principais** | `destinations: Destination[]`, `onSelect: (index: number) => void`, `selectedIndex?: number` |
| **Estados visuais** | Scrolling (cards laterais reduzidos), idle (card central em destaque), selection (card expandindo) |
| **Telas que usam** | `confirmar-destino` (múltiplas opções) |
| **Acessibilidade** | `accessibilityRole="adjustable"`, anúncio de "opção X de Y", suporte a swipe VoiceOver |

### 12.12 VoiceListeningHint

| Campo | Descrição |
| :--- | :--- |
| **Responsabilidade** | Texto de dica que aparece durante estado de escuta. Contextualiza o que o usuário pode falar. |
| **Props principais** | `hint: string`, `examples?: string[]` |
| **Estados visuais** | Visível (fade-in), oculto (fade-out) |
| **Telas que usam** | `inicio`, `confirmar-destino`, `escolher-horario` |
| **Acessibilidade** | `accessibilityLiveRegion="assertive"` para anunciar dicas automaticamente |

### 12.13 VoiceStateBadge

| Campo | Descrição |
| :--- | :--- |
| **Responsabilidade** | Badge pequeno que indica o estado atual do loop de voz (ouvindo, processando, etc.). Pode aparecer no header ou próximo ao orb. |
| **Props principais** | `state: VoiceOrbState`, `compact?: boolean` |
| **Estados visuais** | Um badge por estado, com ícone e cor correspondentes |
| **Telas que usam** | `VoiceScreenLayout` (header) |
| **Acessibilidade** | `accessibilityLabel` descritivo do estado |

### 12.14 AuthLayout

| Campo | Descrição |
| :--- | :--- |
| **Responsabilidade** | Layout base para telas de autenticação (login, cadastro, recuperação de senha). |
| **Props principais** | `children: ReactNode`, `showLogo?: boolean`, `footerLinks?: FooterLink[]` |
| **Estados visuais** | Padrão (sem variantes de estado significativas) |
| **Telas que usam** | `login`, `criar-conta`, esqueci-senha |
| **Acessibilidade** | Formulários com labels associados, navegação por tab, erros anunciados |

### 12.15 SettingsList

| Campo | Descrição |
| :--- | :--- |
| **Responsabilidade** | Lista de itens de configuração/menu. Cada item pode navegar, expandir ou executar ação. |
| **Props principais** | `items: SettingsItem[]` onde cada item tem `label`, `icon?`, `onPress`, `type: 'navigate' \| 'toggle' \| 'action'` |
| **Estados visuais** | Default, item pressionado |
| **Telas que usam** | `configuracoes`, `ajuda` |
| **Acessibilidade** | `accessibilityRole` adequado por tipo de item |

### 12.16 LegalTextScreen

| Campo | Descrição |
| :--- | :--- |
| **Responsabilidade** | Tela de texto legal scrollável (Termos de Uso, Política de Privacidade). |
| **Props principais** | `title: string`, `content: string \| ReactNode` |
| **Estados visuais** | Scroll position (header pode compactar ao scroll) |
| **Telas que usam** | Termos de uso, política de privacidade |
| **Acessibilidade** | Texto scrollável acessível, heading structure adequada |

---

## 13. Estados Visuais Globais

O design system define estados visuais globais que afetam múltiplos componentes simultaneamente. Esses estados são gerenciados pelo `useVoiceConversationLoop` (já planejado) e propagados via context ou props.

| Estado | Orb | ConversationText | BottomActionBar | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `idle` | Pulso lento, grande | Último texto visível | Todos habilitados | Nenhuma interação ativa |
| `speaking` | Ondulação rítmica, grande | Texto aparecendo progressivamente | Desabilitados ou secundários | Assistente falando |
| `listening` | Pulso expansivo + anéis | Hint de escuta visível | Primário pode ser "Parar" | Microfone aberto |
| `processing` | Rotação + shimmer | "Processando..." ou transcript | Loading no primário | Aguardando backend |
| `showing_result` | Pequeno, topo, pulso sutil | Resultado em texto | Ações contextuais | Resultado encontrado |
| `awaiting_confirmation` | Médio, glow, pulso | Pergunta da assistente | Confirmar / Negar / Ouvir | Esperando resposta |
| `error` | Vermelho, tremor | Mensagem de erro amigável | Retry / Voltar | Erro ocorreu |
| `manual_mode` | Estático, cinza, pequeno | Texto estático | Todos habilitados | Interação por toque |

---

## 14. Regras de Implementação

Estas regras são **obrigatórias** para toda implementação futura e derivam dos princípios do produto documentados em [VOICE_CONVERSATION_LOOP_PLAN.md](file:///Users/douglasoliveira/Desktop/RotaBus-API/docs/VOICE_CONVERSATION_LOOP_PLAN.md) e [VOICE_ASSISTANT_ARCHITECTURE.md](file:///Users/douglasoliveira/Desktop/RotaBus-API/docs/VOICE_ASSISTANT_ARCHITECTURE.md).

### 14.1 Paridade voz ↔ toque

* **Voz nunca deve criar caminho paralelo ao toque.** Ambos devem acionar os mesmos handlers e produzir os mesmos resultados.
* Se o usuário fala **"sim"**, é como tocar no botão primário.
* Se fala **"não"**, é como tocar no botão secundário.
* Se fala **"repetir"**, é como tocar no botão de ouvir novamente.
* Se fala **"primeira"**, **"segunda"**, **"terceira"**, é como tocar no card correspondente.

### 14.2 Timing de microfone

* **Microfone nunca abre antes do TTS terminar.** A implementação obrigatória é `speakAndWait` → delay técnico (200–500ms) → `startListening`.
* Trocar de tela **para TTS e STT imediatamente** (cleanup no `useFocusEffect`).

### 14.3 Tratamento de erros

* **Erros de STT** (transcrição falhou, silêncio, timeout) devem aparecer como mensagem amigável: *"Não consegui entender. Pode repetir?"*
* **"Erro de Rede"** só deve aparecer em **falha real HTTP** (`fetch` rejected, timeout de API, status 5xx).
* Erros de STT **nunca** devem dizer "Erro de Rede".

### 14.4 Proteção do modo manual

* **O fluxo manual por toque nunca pode ser bloqueado por overlay de voz.** Se um modal de voz estiver aberto e o usuário tocar fora dele, o modal fecha.
* **Nenhum card/overlay pode ficar vazio bloqueando a tela.** Se um estado inesperado resultar em card sem conteúdo, o componente não deve renderizar.

### 14.5 Dados completos

* Destinos exibidos por voz devem ter **os mesmos dados** de destinos exibidos por toque: `name`, `formattedAddress`, `latitude`, `longitude`, `placeId`.

---

## 15. Etapas Futuras de Implementação

A implementação será dividida em branches pequenas, incrementais e seguras. Cada branch deve ser autônoma, testável e não deve quebrar o fluxo existente.

### Etapa 1: `feat/design-system-voice-layout-foundation`

**Objetivo:** Criar os componentes base do design system sem trocar nenhuma tela existente.

| Tarefa | Descrição |
| :--- | :--- |
| Criar `VoiceScreenLayout` | Layout base com zonas para header, orb, conteúdo e bottom bar |
| Criar `BottomActionBar` | Container fixo com 3 níveis de ação |
| Criar `SecondaryActionButton` | Botão outline/ghost |
| Criar `TertiaryActionLink` | Link de ação terciária |
| Evoluir `VoiceOrb` → `AssistantOrb` | Adicionar estados `speaking`, `showing_result`, `awaiting_confirmation`, `manual_mode` |
| Criar `GlassResultCard` | Card translúcido base com glassmorphism |
| Atualizar `colors.ts` | Adicionar tokens da nova paleta (preservando os existentes) |
| Testes | Snapshot tests dos novos componentes, testes visuais manuais |

**Não faz:** Alterar telas existentes. Componentes devem ser criados como novos arquivos.

### Etapa 2: `feat/design-system-home-voice-first`

**Objetivo:** Aplicar o novo layout na tela inicial.

| Tarefa | Descrição |
| :--- | :--- |
| Migrar `inicio.tsx` para `VoiceScreenLayout` | Substituir layout manual pelo componente |
| Integrar `BottomActionBar` | Falar agora / Digitar destino / Ajuda |
| Integrar `AssistantOrb` | Orb grande centralizado |
| Integrar `ConversationText` | Saudação da assistente |
| Preservar voz existente | Manter `useVoiceConversationLoop` integrado |
| Preservar digitação | Manter botão e fluxo de digitação |
| Testes | Validar fluxo por voz e toque sem regressão |

### Etapa 3: `feat/design-system-confirmar-destino`

**Objetivo:** Aplicar novo layout em confirmação de destino.

| Tarefa | Descrição |
| :--- | :--- |
| Migrar `confirmar-destino.tsx` | Usar `VoiceScreenLayout` |
| Criar `DestinationCard` | Card translúcido com dados completos do destino |
| Integrar `VoiceListeningHint` | "Diga 'sim' para confirmar..." |
| Garantir paridade de dados | Voz e toque mostram mesmos dados |
| Handler unificado | "sim" por voz = botão confirmar |
| Testes | Fluxo completo voz/toque, dados do destino |

### Etapa 4: `feat/design-system-destination-carousel`

**Objetivo:** Criar carrossel de múltiplas opções.

| Tarefa | Descrição |
| :--- | :--- |
| Criar `DestinationCarousel` | Carrossel horizontal com paralaxe |
| Integrar em `confirmar-destino.tsx` | Quando `options.length > 1` |
| Seleção por toque | Tocar no card seleciona |
| Seleção por voz | "primeira", "segunda", "terceira" |
| Card central em destaque | Escala e opacidade diferenciadas |
| Testes | Swipe, seleção, voz, acessibilidade |

### Etapa 5: `feat/design-system-escolher-horario`

**Objetivo:** Aplicar layout voice-first na escolha de horário.

| Tarefa | Descrição |
| :--- | :--- |
| Migrar `escolher-horario.tsx` | Usar `VoiceScreenLayout` |
| Manter chips de data/hora | Preservar funcionalidade existente |
| Manter voz de horário | Preservar `voiceTimeParser` |
| Cards para opções rápidas | "Agora", "+30min", "+1h" como `GlassResultCard` |
| Testes | Fluxo completo voz/toque/digitação |

### Etapa 6: `feat/design-system-melhor-rota`

**Objetivo:** Redesenhar tela de melhor rota.

| Tarefa | Descrição |
| :--- | :--- |
| Migrar `melhor-rota.tsx` | Usar `VoiceScreenLayout` em modo resultado |
| Resumo curto visível | Card com dados essenciais da rota |
| Detalhes colapsados | Expandir ao tocar ou por voz |
| Voz opcional | "Ouvir resumo" como botão, sem microfone automático |
| Testes | Exibição correta de dados, voz, acessibilidade |

### Etapa 7: `feat/design-system-navegacao`

**Objetivo:** Adaptar navegação ao novo design.

| Tarefa | Descrição |
| :--- | :--- |
| Migrar `navegando.tsx` | Adaptar sem prejudicar mapa |
| Botões fixos | Cheguei / Parar / Ouvir caminho |
| Voz opcional | Ações por voz disponíveis mas não automáticas |
| Testes | Mapa funcional, botões, voz |

### Etapa 8: `feat/design-system-auth-settings-help`

**Objetivo:** Redesenhar telas utilitárias.

| Tarefa | Descrição |
| :--- | :--- |
| Criar `AuthLayout` | Layout base para autenticação |
| Redesenhar `login.tsx` | Campos + Google + links |
| Redesenhar `criar-conta.tsx` | Formulário completo |
| Criar esqueci-senha | Nova tela |
| Criar `SettingsList` | Componente de lista |
| Redesenhar `configuracoes.tsx` | Usar `SettingsList` |
| Redesenhar `ajuda.tsx` | FAQ com expansão |
| Criar `LegalTextScreen` | Layout para textos legais |
| Testes | Formulários, navegação, acessibilidade |

### Etapa 9: `docs/voice-first-design-system-final`

**Objetivo:** Finalização documental.

| Tarefa | Descrição |
| :--- | :--- |
| Atualizar este documento | Marcar etapas concluídas, registrar decisões |
| Atualizar `CONVERSATIONAL_E2E_MANUAL_TEST.md` | Checklist final |
| Atualizar `ROADMAP.md` | Integrar fases do design system |
| Atualizar `DECISIONS.md` | ADRs de decisões visuais |

---

## 16. Riscos Técnicos

| Risco | Impacto | Mitigação |
| :--- | :--- | :--- |
| `backdropFilter: blur()` não funciona em Android nativo | Cards sem glassmorphism | Usar `expo-blur` com `BlurView`; fallback para `backgroundColor` semi-transparente |
| Transição entre modos causa janks visuais | UX degradada | Usar `react-native-reanimated` v3 com `withSpring` e `runOnUI`; testar em dispositivos low-end |
| Carrossel de destinos com performance ruim | Scroll travado | Usar `FlatList` com `windowSize` limitado; `getItemLayout` para cards de tamanho fixo |
| Tema escuro com contraste insuficiente | Falha de acessibilidade WCAG | Validar com ferramentas de contraste; manter `highContrastDarkTheme` |
| Migração de telas pode quebrar fluxo existente | Regressão funcional | Migrar uma tela por branch; testes E2E manuais a cada etapa; preservar telas originais até validação completa |
| `VoiceOrb` existente usado em telas não migradas | Incompatibilidade | Manter backward-compatibility no componente evoluído; props opcionais para novos estados |
| Perda de dados do destino no fluxo por voz | UX inconsistente | Regra de paridade de dados obrigatória; validar `formattedAddress` em testes |
| Login com Google pode não funcionar com novo layout | Bloqueio de autenticação | Testar `expo-auth-session` com novo layout antes de merge |

---

## 17. Relação com Documentação Existente

| Documento | Relação |
| :--- | :--- |
| [VOICE_CONVERSATION_LOOP_PLAN.md](file:///Users/douglasoliveira/Desktop/RotaBus-API/docs/VOICE_CONVERSATION_LOOP_PLAN.md) | Define o loop de voz que este design system visualiza. O design system é a camada visual sobre o loop conversacional. |
| [VOICE_ASSISTANT_ARCHITECTURE.md](file:///Users/douglasoliveira/Desktop/RotaBus-API/docs/VOICE_ASSISTANT_ARCHITECTURE.md) | Define a arquitetura backend/frontend do assistente. Este design system é a evolução visual do papel do frontend descrito lá. |
| [ROADMAP.md](file:///Users/douglasoliveira/Desktop/RotaBus-API/docs/ROADMAP.md) | Será atualizado com uma nova fase para o design system (Fase 7.2). |
| [CONVERSATIONAL_E2E_MANUAL_TEST.md](file:///Users/douglasoliveira/Desktop/RotaBus-API/docs/CONVERSATIONAL_E2E_MANUAL_TEST.md) | Será atualizado com checklist de validação visual do novo design. |
| [DECISIONS.md](file:///Users/douglasoliveira/Desktop/RotaBus-API/docs/DECISIONS.md) | Receberá ADR da decisão de tema visual (Opção A) em etapa futura. |

---

*Este documento é a referência oficial do Design System Voice-First do Nuvem. Toda implementação de componente ou redesign de tela deve seguir as diretrizes aqui definidas. Atualizações devem ser registradas via PR na branch correspondente.*
