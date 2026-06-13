# Roteiro de Validação de Persistência Conversacional (PostgreSQL)

Este documento detalha o roteiro e o checklist para validar a persistência de sessões conversacionais utilizando banco de dados PostgreSQL real no backend do Nuvem.

---

## 1. Pré-Requisitos

Para rodar esta validação, você precisará de uma instância do PostgreSQL (pode ser o banco local ou o banco remoto de desenvolvimento/staging no Supabase).

---

## 2. Configurações e Inicialização

Siga os passos abaixo no diretório `backend` para preparar o ambiente:

### Passo 2.1: Variáveis de Ambiente
No seu arquivo `.env` local (que **nunca** deve ser commitado), defina as variáveis:
```env
PERSISTENCE_DRIVER=postgres
DATABASE_URL="postgresql://usuario:senha@endereco-banco:5432/rotabus_dev?schema=public"
```

### Passo 2.2: Atualizar o Prisma Client
Compile o schema local e gere as tipagens do Prisma Client:
```bash
npx prisma generate
```

### Passo 2.3: Aplicar as Migrations no Banco
*   **Em Ambiente Local/Desenvolvimento:** Rode o comando para criar e testar as migrations locais na sua base de desenvolvimento:
    ```bash
    npx prisma migrate dev
    ```
*   **Em Ambiente de Produção/Deploy (Supabase, Render, CI/CD):** Utilize sempre o comando específico de deploy para rodar migrations de forma segura no banco já provisionado:
    ```bash
    npx prisma migrate deploy
    ```

> [!CAUTION]
> Nunca utilize `npx prisma migrate dev` apontando para o banco de dados de produção. Esse comando pode solicitar a recriação do banco de dados (data loss) se detectar desvios no histórico de migrations.

### Passo 2.4: Iniciar o Backend
Suba o servidor em modo de desenvolvimento:
```bash
npm run dev
```

---

## 3. Roteiro e Checklist de Validação Real

Você pode interagir com o backend usando ferramentas como `curl`, Postman, Insomnia ou consumindo a API diretamente do frontend conectado ao backend.

### Checklist 3.1: Criação e Resolução de Destino (`POST /journeys/resolve-destination`)
1.  **Ação:** Dispare uma chamada para `/journeys/resolve-destination` sem passar cabeçalho ou propriedade `sessionId`.
    ```bash
    curl -X POST http://localhost:3000/journeys/resolve-destination \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer <SEU_JWT_TOKEN>" \
      -d '{"text": "Shopping Uberaba", "origin": {"lat": -19.747, "lng": -47.939}}'
    ```
2.  **Validação:**
    *   [ ] O backend retorna o payload conversacional contendo o UUID gerado em `metadata.sessionId`.
    *   [ ] No banco de dados, rode a query `SELECT * FROM "ConversationSession" WHERE "sessionId" = 'UUID_RETORNADO';` e confirme que a linha foi inserida no estado `WAITING_CONFIRMATION` com o campo `context` populado.

### Checklist 3.2: Envio de `sessionId` e Comando `CONFIRM` (`POST /journeys/command`)
1.  **Ação:** Envie o comando `CONFIRM` para a sessão aberta no passo anterior.
    ```bash
    curl -X POST http://localhost:3000/journeys/command \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer <SEU_JWT_TOKEN>" \
      -d '{"sessionId": "UUID_DA_SUA_SESSAO", "command": "CONFIRM"}'
    ```
2.  **Validação:**
    *   [ ] O backend retorna status `200` com `conversationState: "JOURNEY_DISPLAYED"`.
    *   [ ] No banco de dados, confirme que a linha mudou para `currentState = 'JOURNEY_DISPLAYED'` e que o `expiresAt` foi renovado (Sliding TTL).

### Checklist 3.3: Comando `REPEAT` (`POST /journeys/command`)
1.  **Ação:** Dispare o comando `REPEAT` para repetir o estado conversacional atual.
    ```bash
    curl -X POST http://localhost:3000/journeys/command \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer <SEU_JWT_TOKEN>" \
      -d '{"sessionId": "UUID_DA_SUA_SESSAO", "command": "REPEAT"}'
    ```
2.  **Validação:**
    *   [ ] O backend retorna o estado conversacional idêntico, com `success: true`.
    *   [ ] No banco de dados, o campo `expiresAt` foi atualizado para mais 10 minutos (Sliding TTL) e a sessão permanece ativada.

### Checklist 3.4: Comando `CANCEL` e Encerramento (`POST /journeys/command`)
1.  **Ação:** Dispare o comando `CANCEL` para encerrar o diálogo.
    ```bash
    curl -X POST http://localhost:3000/journeys/command \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer <SEU_JWT_TOKEN>" \
      -d '{"sessionId": "UUID_DA_SUA_SESSAO", "command": "CANCEL"}'
    ```
2.  **Validação:**
    *   [ ] A sessão foi excluída fisicamente do banco de dados (se for usuário anônimo) ou teve o campo `endedAt` preenchido (se for usuário logado).
    *   [ ] Tentar ler essa mesma sessão novamente em endpoints conversacionais deve retornar erro `400` ("Sessão conversacional não encontrada ou expirada").

---

## 4. Validação Automatizada (Smoke Test)

Para atestar de forma rápida se a conexão do repositório de sessões e o driver do Prisma estão corretos, execute o script de smoke test automatizado:

```bash
cd backend
npm run sessions:smoke:postgres
```
*   **Esperado:** O script deve rodar todo o CRUD do `SessionManager` no banco de dados em lote, desconectar o Prisma com sucesso e retornar log verde ao final.
