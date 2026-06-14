# Guia de Deploy e Configurações de Produção

Este guia orienta o deploy do backend do Nuvem, focando no provisionamento e inicialização da persistência de sessões conversacionais utilizando PostgreSQL/Supabase com Prisma.

---

## 1. Variáveis de Ambiente Necessárias

Para ativar a persistência em ambiente de homologação ou produção, configure as seguintes variáveis no servidor de deploy (ex: Render, Heroku, AWS, Supabase):

*   `DATABASE_URL`: String de conexão segura com o PostgreSQL (ex: `"postgresql://usuario:senha@endereco-banco:5432/rotabus?schema=public"`).
*   `PERSISTENCE_DRIVER`: Define o driver de armazenamento das sessões conversacionais.
    *   `postgres`: Ativa a persistência durável no PostgreSQL (Recomendado para Produção).
    *   `memory`: Fallback em memória RAM local utilizando `Map` (Recomendado para Testes Unitários e Desenvolvimento Offline).
    *   *Se ausente:* O sistema adota `memory` como fallback seguro.

> [!WARNING]
> Nunca versione chaves reais ou credenciais de banco de dados nos arquivos de exemplo `.env.example` ou no código fonte do projeto.

---

## 2. Pipeline de Inicialização do Banco (Prisma)

No pipeline de deploy de produção, os seguintes comandos devem ser executados em sequência no diretório `backend`:

### 2.1 Validação do Schema
Valida a consistência sintática e integridade relacional do schema do Prisma:
```bash
cd backend
npx prisma validate
```

### 2.2 Geração do Prisma Client
Compila o arquivo de schema para atualizar as definições locais do client no diretório `node_modules` ou build:
```bash
npx prisma generate
# Ou via script de conveniência:
npm run prisma:generate
```

### 2.3 Aplicação das Migrations
Aplica as migrations pendentes de forma segura no banco de dados de produção, sem recriar tabelas existentes:
```bash
npx prisma migrate deploy
# Ou via script de conveniência:
npm run prisma:migrate
```

---

## 3. Limpeza e Manutenção Periódica

Para evitar o crescimento indefinido da tabela `ConversationSession` no PostgreSQL, foi disponibilizado um script de manutenção que remove registros cujos prazos de Sliding TTL expiraram.

### 3.1 Execução Manual
Para executar a limpeza pontual e manual a partir do terminal do servidor:
```bash
cd backend
npm run sessions:cleanup
```

### 3.2 Execução Agendada (Cron)
Recomenda-se configurar uma tarefa agendada (Cron job) em sua plataforma de deploy ou via infraestrutura do SO para disparar a limpeza periodicamente (ex: a cada 10 ou 15 minutos):
```cron
*/15 * * * * cd /caminho/para/projeto/backend && npm run sessions:cleanup >> /var/log/rotabus-cleanup.log 2>&1
```

---

## 4. Validações Pré-Deploy e Pós-Deploy

### 4.1 Checkout Técnico (Pré-Deploy)
Antes de aprovar o deploy de uma branch, certifique-se de que os testes globais estejam verdes e o linter de estilos esteja sem erros.

No diretório do **Backend**:
```bash
cd backend
npx prisma validate
npx prisma generate
npm test
```

No diretório do **Frontend**:
```bash
cd frontend
npm test
npm run lint
```

### 4.2 Smoke Test de Persistência (Pós-Deploy)
Após subir a aplicação em produção e com as migrations aplicadas, execute o script de smoke test no servidor de aplicação para certificar-se de que a conexão assíncrona com a tabela `ConversationSession` via Prisma está íntegra:
```bash
cd backend
npm run sessions:smoke:postgres
```
> [!NOTE]
> Este script executará um fluxo completo e seguro de gravação, leitura, atualização e remoção de uma sessão conversacional de teste temporária no PostgreSQL real configurado no servidor.

---

## 6. Frontend (Android)

### 6.1 Build Local do APK
Devido às limitações de memória do plano gratuito do EAS (Expo Application Services), recomenda-se realizar o build do Android localmente utilizando o seu próprio hardware.

**Pré-requisitos:**
- Ter o ambiente de desenvolvimento Android configurado (Android Studio, SDK, etc).
- Variáveis de ambiente configuradas no arquivo `.env` do frontend.

**Comando para gerar o APK:**
```bash
cd frontend
# Carregar variáveis de ambiente (macOS/Linux)
set -a && source .env && set +a
# Iniciar build local
eas build -p android --profile preview --local
```

### 6.2 Configuração do Sentry
Atualmente, o upload automático de sourcemaps do Sentry está desativado no arquivo `frontend/app.config.js` (`disableOnRelease: true`) para permitir que o build seja concluído sem a necessidade de tokens de autenticação imediatos ou falhas de rede durante a compilação.

**Para ativar logs de erro reais em produção futuramente:**
1. Altere `disableOnRelease: false` no arquivo `frontend/app.config.js`.
2. Obtenha um **Auth Token** no painel do Sentry (**User Settings > Auth Tokens**).
3. Configure o token no EAS como um segredo do projeto:
   ```bash
   eas env:create project SENTRY_AUTH_TOKEN
   ```
4. Certifique-se de que a organização e o projeto no `app.config.js` correspondem aos do seu painel Sentry.

---

## 7. Estratégias de Fallback e Alertas

### 7.1 Retorno para Modo Memória
Caso o banco de dados PostgreSQL passe por instabilidade física ou falha de rede, é possível desativar temporariamente a persistência durável redefinindo a variável no ambiente de deploy:
```env
PERSISTENCE_DRIVER=memory
```
*   **Alerta:** O driver em `memory` não garante sobrevivência dos dados de diálogo ativos caso o processo da aplicação seja reiniciado (e.g. em deploys ou escalonamentos automáticos).
*   **Requisitos do Modo Postgres:** O modo `postgres` exige que a migration da tabela `ConversationSession` esteja devidamente aplicada no banco remoto. Caso contrário, a API de comandos e rotas conversacionais retornará erro de banco `500` ao falhar na gravação do registro.
