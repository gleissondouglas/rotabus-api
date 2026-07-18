# Infraestrutura e Operação (DevOps)

Este documento dita como a arquitetura do projeto é empacotada, persistida e enviada a produção. A infraestrutura do Nuvem prefere PaaS moderno ao invés do gerenciamento cru de VPS (IaaS) visando velocidade e menor fricção de manutenção.

## 1. Banco de Dados Remoto (Supabase)

- Como PostgreSQL gerenciado, o banco está hospedado na cloud do **Supabase**.
- Supabase lida com pgbouncer (Connection Pooling) protegendo a base contra requisições simultâneas oriundas do escalonamento de contêineres do backend (Node.js/Prisma).
- **Variável Crítica:** `DATABASE_URL` aponta nativamente para a string Postgres transacional.

## 2. Backend (Deploy/Containers)

O empacotamento ideal do backend Node.js deve utilizar **Docker**.
- **Imagem:** Node (LTS alpine, como `node:20-alpine`).
- **Build Steps:**
  - Instala dependências (npm install).
  - Executa migrações (`npx prisma migrate deploy`) no runtime ou build pipeline.
  - Gera Prisma Client (`npx prisma generate`).
  - Executa `node src/server.js`.
- **Hospedagem Recomendada:** *Render.com*, *Railway* ou *Fly.io* (Plataformas que escalam automaticamente web services orientados a stateless Docker).

## 3. Frontend (CI/CD Mobile via EAS)

O Expo App é distribuído utilizando a ferramenta nativa EAS (Expo Application Services).
- **Arquivos Vitais:** `eas.json` (Profiles de build) e `app.config.js`.
- **EAS Build:** A nuvem da Expo compila os `.apk` (Android) e `.ipa` (iOS) sem a necessidade primária de computadores caros com MacOS local da equipe.
- **EAS Update (OTA):** O Over The Air Updates é essencial. Caso ajustemos uma tela de SDUI, fazemos push. O app na mão dos idosos recebe a nova interface na próxima abertura, sem depender de aprovações demoradas nas Lojas da Google/Apple.

## 4. Variáveis de Ambiente (Configuração .env)

### Backend `.env`
- `PORT=3000`
- `DATABASE_URL="postgres://..."`
- `JWT_SECRET="chave_super_secreta"`
- `JWT_EXPIRES_IN="10h"`
- `GOOGLE_ROUTES_API_KEY="AIza..."`
- `GOOGLE_PLACES_API_KEY="AIza..."`
- `PERSISTENCE_DRIVER="postgres"` (ou "memory" local).

### Frontend `.env`
- `EXPO_PUBLIC_API_URL="https://backend-prod.render.com"` (As chaves `EXPO_PUBLIC_` são injetadas estaticamente durante o build).
- O Frontend não possui (e nunca deve possuir) API Keys do Google Platform cruas vazadas. Todas solicitações de Maps passam ou usam backend proxies ou assinaturas isoladas.

## 5. Escalabilidade e Persistência do Dialog Manager
Um cuidado infraestrutural: Se adotássemos instâncias paralelas rodando (Auto-scale, Load Balancer) no `Render.com` e a FSM ficasse salva na RAM (`memory driver`), as chamadas subsequentes do celular dariam falha de sessão 404 (já que a instância A salvou e a instância B foi acionada).
Por conta disso, optou-se pela migração da persistência conversacional pro PostgreSQL/Prisma (conforme estado de produção atual da FSM) antes do go-live massivo.
