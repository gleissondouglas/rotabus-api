# Guia de Contribuição e Onboarding

Bem-vindo ao Nuvem! Siga este guia para subir seu ambiente local rapidamente e entender os padrões obrigatórios antes de abrir seu primeiro Pull Request.

## 1. Pré-Requisitos

- **Node.js:** Versão 20+ (LTS).
- **Gerenciador de Pacotes:** `npm`.
- **Banco de Dados:** PostgresSQL (Instalado localmente, ou via Docker Compose).
- **Emulador Mobile:** Android Studio Emulator ou Expo Go físico no seu próprio smartphone.
- **Conta GCP (Opcional p/ Produção):** Necessita chaves válidas de Google Routes e Places. Peça ao Lead as chaves estáticas de desenvolvimento `.env`.

## 2. Configurando o Ambiente Backend

1. Abra um terminal na pasta raiz e navegue: `cd backend`
2. Instale dependências: `npm install`
3. Crie o arquivo de variáveis baseado no template: `cp .env.example .env`
4. Edite o `.env` com sua URL de Banco (Ex: `DATABASE_URL="postgresql://postgres:senha@localhost:5432/rotabus?schema=public"`).
5. Suba o schema no banco: `npx prisma migrate dev`
6. Inicie o servidor em modo hot-reload: `npm run dev`

O backend responderá em `http://localhost:3000`. Acesse para ver o status.

## 3. Configurando o Ambiente Frontend (Mobile)

1. Abra outro terminal: `cd frontend`
2. Instale dependências: `npm install`
3. Crie o `.env`: `cp .env.example .env`
4. Ajuste a URL da API local apontando pro IP da sua rede WiFi interna (Expo precisa acessar o Node). Ex: `EXPO_PUBLIC_API_URL="http://192.168.1.15:3000"`. Não use `localhost` se for rodar no dispositivo físico.
5. Inicie o Metro Bundler: `npx expo start`
6. No seu celular, leia o QRCode com o App Expo Go ou clique `a` no terminal para rodar o emulador Android.

## 4. Padrões de Código e Boas Práticas

- **Backend (JavaScript):**
  - Mantenha `const` ao invés de `let`.
  - Use blocos `try/catch` sempre que o controller comunicar com o service. Deixe o erro espumar para a função `next(error)`.
  - O código usa *CommonJS* puro nativamente (`require` e `module.exports`). Não implemente Babel/TS agressivo sem discutir ADR.
  - Comentários e Documentações internas devem seguir no formato DocBlock em Inglês, embora a doc de negócios e telas seja focada no Português.
- **Frontend (TypeScript Estrito):**
  - Tudo deve ser tipado. Componentes usam `React.FC<Props>`.
  - Proibido uso liberal de `any`.
  - Arquivos `.tsx` no diretório raiz `app/` definem diretamente uma nova página pelo Router.

## 5. Processo de Pull Request (Git Flow Simplificado)

1. **Branching:** Crie uma branch a partir de `main` no formato `feature/nome-breve` ou `fix/corrige-falha`.
2. **Commits:** Adote o padrão *Conventional Commits*:
   - `feat: adiciona TTS robusto no microfone`
   - `fix: corrige timeout da FSM no Google places`
   - `docs: atualiza guia de infraestrutura`
3. **Checklist Pré-Push:**
   - O comando `npm test` do backend passou?
   - O lint e `npm run typecheck` do frontend falharam?
4. **Code Review:** Submeta o PR. O revisor focará não apenas no código, mas na **acessibilidade** (O botão é clicável fácil? A voz fala de modo contínuo?).
5. **Merge:** Ao ser aprovado com Merge (Squash), feche a tarefa do board associado.

Bem vindo à equipe! Construa a acessibilidade que você quer ver no mundo.
