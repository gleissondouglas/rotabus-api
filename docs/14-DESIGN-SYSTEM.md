# Design System e Tokens

O Nuvem exige uma padronização extrema. Como a carga visual precisa ser baixíssima, criamos um Design System simplificado com tokens utilitários centralizados em `frontend/src/theme/`.

## 1. Cores e Identidade (`colors.ts`)

O uso de cores não deve ser estético, mas comunicativo.
- **Brand (Primárias):** Azul vibrante, verde sólido, etc (Dependendo da customização regional).
- **Backgrounds:** Escuros de alto contraste (Dark mode obrigatório ou muito balanceado) visando aliviar fadiga visual ou problemas de catarata, comuns em idosos.
- **Feedback States:**
  - `Success`: Operações de confirmação de rotas, ou aprovações de destino.
  - `Error`: Vermelho para rejeições fortes (Timeout do Mic).
  - `Listening`: Ciano/Azul que indica sensorialidade de Voz, piscando no `VoiceOrb`.

## 2. Tipografia

- Fontes sem-serifa clássicas (Inter, Roboto ou fontes default do sistema). 
- O diferencial não é o tipo de fonte, mas o `fontSize` de leitura nativa escalada. O texto não usa tamanhos miúdos como `12px` de rodapé. Todo o conteúdo é estruturado como Heading H2/H1 e parágrafo grande.

## 3. Layout e Espaçamento (`layout.ts`)

- Espaçamento padrão grande (16px base, 32px entre seções).
- Touch Targets: Segundo as heurísticas de ergonomia, nenhum botão deve ter altura menor que 48px, preferencialmente 56px de altura cheia na tela. (Wide buttons para evitar erro de touch em usuários com Parkinson).
- Sombras projetadas de modo nítido no `VoiceResponseButton` para gerar percepção de profundidade tátil.

## 4. Componentização

- **`VoicePromptText.tsx`:** O balão da Assistente. Grande, centrado, altamente contrastado.
- **`BottomActionBar.tsx`:** Container flutuante que hospeda atalhos que não sujam a visualização principal do conteúdo.
- **`VoiceOrb.tsx`:** Não usa imagens externas, usa renderização vetorial e de `react-native-reanimated` para pulsar os tokens do estado sensorial.
