# Guia de Validação Manual Ponta a Ponta (E2E): Fluxo Conversacional Nuvem

Este documento descreve o roteiro estruturado para validar manualmente o fluxo conversacional voice-first integrado entre o frontend React Native (Expo) e o backend Node.js (Express) do assistente de mobilidade Nuvem.

---

## 1. Objetivo do Teste

Garantir que a FSM (Máquina de Estados Finita), o gerenciamento temporário de sessões conversacionais em memória RAM e a decoração de payload funcionem perfeitamente em sincronia com as ações do usuário (voz, digitação e toques) no frontend, com foco em:
*   Ciclo de vida do `sessionId` (geração, tráfego, reenvio e expiração).
*   Execução adequada de comandos conversacionais (`CONFIRM`, `CANCEL`, `REPEAT` e `SELECT_OPTION`).
*   Manutenção do fallback estável para formatos legados da API.

---

## 2. Pré-requisitos e Ambiente

*   **Node.js:** Versão 18 ou superior.
*   **Expo CLI:** Instalado para executar o frontend local.
*   **Dispositivo de Teste:** Simulador de iOS, Emulador de Android ou dispositivo físico via Expo Go (necessita que ambos estejam na mesma rede local).

### 2.1 Comandos para Rodar o Backend
No diretório `backend`:
```bash
cd backend
# Instalar dependências se necessário
npm install
# Iniciar o servidor de desenvolvimento
npm run dev
```
O backend estará rodando por padrão em: `http://localhost:3000`.

### 2.2 Comandos para Rodar o Frontend
No diretório `frontend`:
```bash
cd frontend
# Instalar dependências se necessário
npm install
# Iniciar o Expo Dev Server
npm start
```
Use as teclas `a` para Android, `i` para iOS ou escaneie o QR Code no app Expo Go do celular.

---

## 3. Roteiro e Checklist de Testes

### 3.1 Fluxo por Voz (Input Principal)
- [ ] **Passo 1:** Abra o app e acesse a tela Inicial (`/inicio`).
- [ ] **Passo 2:** Pressione e segure o ícone do microfone, ouça o sinal sonoro e fale um destino claro (ex: *"Shopping Uberaba"*).
- [ ] **Passo 3:** Solte o botão e observe a transição automática para a tela de processamento (`/processando`).
- [ ] **Passo 4:** Verifique se o aplicativo transiciona com sucesso para a tela de confirmação (`/confirmar-destino`).
- [ ] **Passo 5:** O assistente deve falar o `speechText` sintetizado (ex: *"Encontrei Shopping Uberaba. É esse o lugar?"*).

### 3.2 Fluxo Digitado (Fallback Manual)
- [ ] **Passo 1:** Na home, clique na barra de busca de destino ou no botão "Digitar Destino".
- [ ] **Passo 2:** Digite um endereço (ex: *"Praça Rui Barbosa"*) e clique em "Buscar rota".
- [ ] **Passo 3:** Verifique se o app transiciona para a tela de confirmação (`/confirmar-destino`) exibindo os dados nos campos de tela.

### 3.3 Validação dos Comandos Conversacionais (FSM)

#### A. Comando `CONFIRM`
- [ ] **Passo 1:** Na tela de confirmação de destino, com o local correto exibido, clique no botão principal **"Buscar rota para este lugar"**.
- [ ] **Passo 2:** O app deve acionar o comando no backend e avançar imediatamente para a tela de escolha de horário ou cálculo de rota (`/escolher-horario` -> `/melhor-rota`).
- [ ] **Passo 3:** A tela `/melhor-rota` deve renderizar o resumo de passos e o ônibus correto da viagem.

#### B. Comando `REPEAT`
- [ ] **Passo 1:** Na tela de confirmação (`/confirmar-destino`) ou na tela de rota (`/melhor-rota`), clique no botão **"Ouvir destino"** ou **"Ouvir resumo"**.
- [ ] **Passo 2:** O backend deve registrar a requisição sem mudar o estado conversacional da FSM.
- [ ] **Passo 3:** O frontend deve falar o texto novamente de forma íntegra.

#### C. Comando `CANCEL`
- [ ] **Passo 1:** Na tela de confirmação ou rota, clique em **"Escolher outro destino"** ou no botão de voltar/início.
- [ ] **Passo 2:** O backend deve resetar o estado da FSM para `IDLE` e apagar a sessão conversacional de memória RAM.
- [ ] **Passo 3:** O frontend deve ser redirecionado para a tela inicial (`/inicio`) e limpar localmente o `sessionId`.

#### D. Comando `SELECT_OPTION` (Ambiguidades)
- [ ] **Passo 1:** No início, faça uma busca por um termo ambíguo (ex: *"Hospital"*).
- [ ] **Passo 2:** O app deve exibir uma lista de sugestões na tela `/confirmar-destino` com cabeçalho "Selecione uma opção".
- [ ] **Passo 3:** Toque em uma das opções da lista (ex: *"Hospital Mário Palmério"*).
- [ ] **Passo 4:** O backend deve registrar a opção escolhida na sessão FSM e o app avançará com a opção selecionada no fluxo.

---

## 4. Como Observar o `sessionId` no Tráfego

Para validar que o `sessionId` está sendo salvo no frontend e reenviado ao backend:
1.  **Monitoramento no Console de Debug do React Native/Metro:**
    Observe a saída do console no Metro Bundler. Ao completar o primeiro passo (`resolveDestination`), o JSON recebido deve conter `metadata.sessionId` com um UUID válido (ex: `bae60b96-0b2b-4a86-af23-0d7e62f090ef`).
2.  **Monitoramento no Console do Backend (Node.js):**
    Observe os logs gerados no console do backend. Nas chamadas de comandos, deve aparecer o log:
    `[JourneysController] POST /resolve-destination solicitado pelo userId: ... | Session ID: <UUID>`
    Certifique-se de que o UUID nas chamadas subsequentes seja idêntico ao UUID gerado na primeira chamada da interação, provando que o frontend salvou e reenviou o `sessionId` corretamente.

---

## 5. Critérios de Aceitação e Rejeição

### 5.1 Critérios para Aprovar
*   O `sessionId` é mantido constante durante todo o ciclo de múltiplos turnos de um mesmo diálogo.
*   O `sessionId` é apagado da memória local após o acionamento do comando `CANCEL` (clique em mudar destino ou voltar).
*   Se o usuário forçar uma nova viagem a partir da home, a sessão conversacional antiga é limpa e uma nova sessão é iniciada.
*   Telas e falas usam com sucesso as novas propriedades estruturadas, mantendo fallbacks estáveis se as propriedades novas não forem enviadas.

### 5.2 Critérios para Reprovar
*   A sessão conversacional do backend expirar ou falhar e causar o travamento completo das telas do frontend (ausência de fallback tolerante).
*   Mudanças de rotas alterarem e quebrarem o layout clássico de mapas ou listagem de passos.
*   O frontend gerar um novo `sessionId` a cada clique ou chamada de comando em um mesmo diálogo, quebrando a consistência da FSM.

---

## 6. Persistência Local e Tratamento de Expiração de Sessão

### 6.1 Onde o sessionId é salvo
O `sessionId` é salvo em memória global e também no storage local persistente do dispositivo:
*   **Web:** Gravado no `localStorage` sob a chave `nuvem_session_id`.
*   **iOS/Android:** Gravado de forma segura e criptografada via `expo-secure-store` sob a chave `nuvem_session_id`.
*   A lógica é abstraída pelo helper `storage` dentro de [session.service.ts](file:///Users/douglasoliveira/Desktop/RotaBus-API/frontend/src/services/session.service.ts).

### 6.2 Quando o sessionId é restaurado
Ao carregar a tela principal (`/inicio`), o método assíncrono `sessionService.restoreSessionId()` é disparado no `useEffect` de inicialização para resgatar qualquer sessão aberta anteriormente em background.

### 6.3 Quando o sessionId é limpo
A limpeza local do `sessionId` ocorre nos seguintes momentos:
*   **Nova busca:** Ao iniciar uma nova busca digitada ou falada nas telas `/inicio`, `/ouvindo` ou `/digitar-destino`.
*   **Comando CANCEL:** Ao clicar em "Escolher outro destino" (tela de confirmação) ou em voltar ao início (tela de melhor rota).
*   **Sessão Expirada:** Ao receber uma resposta de erro `400` do backend contendo a mensagem de que a sessão não foi encontrada ou expirou.
*   **Logout/Limpeza:** Ao fazer logout do usuário no aplicativo (`sessionService.clearSession()`).

### 6.4 Como o app reage a uma sessão expirada
*   Se o backend retornar o erro `"Sessão conversacional não encontrada ou expirada."`, o serviço [journey.service.ts](file:///Users/douglasoliveira/Desktop/RotaBus-API/frontend/src/services/journey.service.ts) intercepta o erro, limpa o `sessionId` local imediatamente e propaga o erro.
*   A tela de confirmação (`/confirmar-destino`) captura este erro e exibe um alerta amigável (`Alert.alert`): *"Sua sessão de diálogo expirou. Vamos reiniciar sua busca."* redirecionando o usuário de volta à home de forma segura.

### 6.5 Como testar a expiração manualmente
1.  Inicie uma busca e chegue à tela `/confirmar-destino`.
2.  Aguarde 10 minutos (tempo padrão do sliding TTL do backend) ou simule forçando uma chamada com um `sessionId` aleatório inválido.
3.  Tente interagir clicando em "Buscar rota para este lugar".
4.  O app deve disparar o `Alert.alert` de sessão expirada e redirecioná-lo para a tela `/inicio` limpando a sessão.

---

## 7. Checklist de Homologação de UX, Horários e Linhas de Ônibus
 
Este checklist deve ser validado após a aplicação das melhorias de UX de tempo, formulário e informações de transporte público:
 
- [ ] **Seleção Visual dos Próximos 7 Dias:** Na tela `/escolher-horario` (no Modal de escolha de data/hora), o campo de digitação técnica da data `YYYY-MM-DD` deve ser substituído por uma lista horizontal de chips contendo os próximos 7 dias formatados (ex: `"Hoje"`, `"Amanhã"`, `"Dom 15"`, etc.).
- [ ] **Máscara de Hora:** No campo de texto de hora, a digitação de números deve ser formatada automaticamente como `HH:mm` (ex: digitou "1030" vira "10:30").
- [ ] **Ajuste de Horário (+/- 10 min):** Ao lado do campo de hora, os botões de `+` e `-` devem aumentar ou diminuir o horário em 10 minutos a cada clique.
- [ ] **Opções Rápidas de Horário:** Abaixo da hora, os botões rápidos `"Agora"`, `"+30 min"`, `"+1h"` e `"+2h"` devem preencher a data e a hora correspondente imediatamente ao clique.
- [ ] **Formatação de Tempo Curta nas Telas:** Em `/navegando` e `/chegada`, em vez de exibir datas longas e apertadas como `"terça-feira às 09:10"`, o tempo do ônibus deve ser exibido na forma curta: `"terça, 09:10"`, `"hoje, 21:30"`, `"amanhã, 12:40"`.
- [ ] **Label do Card de Tempo:** O label clássico `"ÔNIBUS"` nas caixas pequenas das telas de navegação e chegada deve ser alterado para `"CHEGA"`, melhorando a legibilidade.
- [ ] **Nome e Sentido da Linha abaixo da Linha:** Nas telas `/navegando` (no grid do ponto de espera e no card inferior de caminhada) e `/chegada` (no display principal do ônibus), caso exista o nome/sentido da linha (ex: `"Terminal Beija-Flor / Jd. Copacabana"`), ele deve ser renderizado logo abaixo do número destacado da linha.
- [ ] **Fallback de Linha:** Se o backend não retornar `lineName`/`headsign`, o app deve renderizar somente o número da linha (ex: `"Linha 26"`), sem quebrar o layout e sem exibir campos vazios.
- [ ] **Validação de 7 dias:** Ao submeter um horário customizado no frontend ou no backend, datas anteriores a hoje ou posteriores aos próximos 7 dias devem ser barradas, emitindo vibração de erro no app.


