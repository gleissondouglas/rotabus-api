# Frontend (React Native & Expo)

A camada de interface do Nuvem foi construída utilizando o ecossistema moderno do React Native com **Expo** e **Expo Router**.

## 1. Estrutura de Pastas

```text
frontend/
├── app/                  # Roteamento file-based (Expo Router)
├── src/
│   ├── components/       # Componentes burros (UI)
│   ├── config/           # Configurações de serviços e SDKs
│   ├── contexts/         # Contextos Globals React (Acessibilidade, Sessão)
│   ├── hooks/            # Hooks customizados e orquestradores lógicos
│   ├── onboarding/       # Lógicas de tela de introdução
│   ├── services/         # Wrappers e chamadas de API nativa ou HTTP
│   ├── state/            # Estado global isolado (ex: sessão da home)
│   ├── theme/            # Design System, Cores, Layout (Espaçamentos)
│   ├── types/            # Tipagens TypeScript estritas
│   └── utils/            # Utilitários (Parsers, Mappers, Date-time)
```

## 2. O Roteamento (Expo Router)

Toda navegação baseia-se em arquivos dentro da pasta `app/`.
- `app/index.tsx` (Splash/Redirect)
- `app/inicio.tsx` (Ponto principal do mapa e input de voz)
- `app/confirmar-destino.tsx`
- `app/escolher-horario.tsx`
- `app/melhor-rota.tsx`

Cada tela consome diretamente o estado da API e não deve manter regras densas de negócio (elas delegam para hooks customizados).

## 3. Orquestração Conversacional (`useVoiceConversationLoop`)

Este é o hook de maior complexidade e responsabilidade. Ele funciona como uma FSM *local* no cliente para controlar a interação Microfone-Som-Decisão.

**Responsabilidades do `useVoiceConversationLoop`:**
- Chama o TTS (Text-to-Speech) via `speakAndWait`.
- Bloqueia o início do STT (Microfone) até que o TTS finalize completamente.
- Levanta a UI do `VoiceVisualizer` ou `VoiceOrb`.
- Recebe a transcrição final do expo-speech.
- Despacha para o **`voiceIntentParser`** para limpar e normalizar ("Sim", "Não", "Primeira opção").
- Executa a função `onCommand` fornecida pela tela.

## 4. UI e Componentes Base

Os componentes no diretório `components/` não devem saber da existência de Sessões do backend ou Regras complexas.

### VoiceOrb
Um botão principal, centralizado na tela `inicio.tsx`, que reflete o status sensorial:
- **Idle/Stop:** Silencioso.
- **Speaking:** Pulsando cores com som (O Bot fala).
- **Listening:** Aguardando comando (O Bot escuta).

### LiveTranscript
Um componente de acessibilidade que imprime na tela em tempo real o que o motor de transcrição STT está ouvindo (ajudando em diagnóstico).

## 5. Integrações de Hardware

- **Speech-to-Text (STT):** Configurado via `expo-speech-recognition`.
- **Text-to-Speech (TTS):** Configurado via `expo-speech`. O sistema requer implementações que garantam promessas que só resolvem ao finalizar o áudio (`speakAndWait`).
- **Haptics:** Uso de `expo-haptics` para vibração. Retorno tátil essencial para PCDs e feedback de ação bem sucedida sem forçar visão.

## 6. Lógica Visual (SDUI - Server Driven UI)

A tela `confirmar-destino.tsx` age de forma genérica. Ela recebe o objeto do backend:

```json
"displayData": {
    "title": "Confirmação",
    "items": [{ "name": "Hospital Mário Palmério" }]
}
```

O Frontend simplesmente itera os `items` e renderiza componentes. Se o Backend no futuro alterar os itens sugeridos, o Frontend não requer atualização via loja de aplicativos (App Store/Play Store).

## 7. Responsabilidade do Desenvolvedor Frontend

- **Não implementar IA generativa no frontend.**
- **Proteger o Loop:** Nunca inicie o microfone se a flag global de `isSpeaking` for verdadeira.
- Manter tipagens rígidas no `src/types/interaction.types.ts` sempre sincronizadas com a evolução da API.
