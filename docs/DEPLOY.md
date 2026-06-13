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

## 4. Validações Pré-Deploy (Checkout Técnico)

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

---

## 5. Estratégias de Fallback e Alertas

### 5.1 Retorno para Modo Memória
Caso o banco de dados PostgreSQL passe por instabilidade física ou falha de rede, é possível desativar temporariamente a persistência durável redefinindo a variável no ambiente de deploy:
```env
PERSISTENCE_DRIVER=memory
```
*   **Alerta:** O driver em `memory` não garante sobrevivência dos dados de diálogo ativos caso o processo da aplicação seja reiniciado (e.g. em deploys ou escalonamentos automáticos).
*   **Requisitos do Modo Postgres:** O modo `postgres` exige que a migration da tabela `ConversationSession` esteja devidamente aplicada no banco remoto. Caso contrário, a API de comandos e rotas conversacionais retornará erro de banco `500` ao falhar na gravação do registro.
