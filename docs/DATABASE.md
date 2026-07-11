# Modelo de Dados e Persistência: Nuvem (RotaBus-API)

Este documento registra a estrutura do banco de dados do projeto Nuvem, detalhando as tabelas atuais, relacionamentos, estratégias de cache e o planejamento para evoluções futuras.

---

## 1. Objetivo do Documento

O `DATABASE.md` tem como finalidade documentar como o sistema armazena e gerencia informações para apoiar a persistência de usuários, recuperação de senha, cache de rotas e o controle de uso de APIs externas (proteção financeira).

---

## 2. Tecnologia e Camadas

*   **Banco Relacional:** PostgreSQL.
*   **ORM:** Prisma.
*   **Isolamento:** Conforme a **ADR-003**, o acesso ao banco é restrito à camada de `Repositories`. O núcleo do sistema não deve depender diretamente do Prisma Client.

---

## 3. Modelo Atual do Banco (Prisma Schema)

### 3.1 Tabela: `User`
**Finalidade:** Armazenar os dados de identidade e perfil dos usuários.
*   **Campos:**
    *   `id` (Int): Chave primária, autoincremento.
    *   `name` (String): Nome do usuário.
    *   `email` (String): E-mail único (login).
    *   `passwordHash` (String): Hash da senha (nunca texto puro).
    *   `role` (String): Papel do usuário (Default: "USER").
    *   `createdAt` / `updatedAt`: Timestamps automáticos.
*   **Índices:** `@unique` no campo `email`.
*   **Relacionamentos:** Possui relação 1:N com `PasswordResetToken` e `ApiUsage`.

### 3.2 Tabela: `PasswordResetToken`
**Finalidade:** Gerenciar tokens temporários para recuperação de senha.
*   **Campos:**
    *   `id` (Int): Chave primária.
    *   `tokenHash` (String): Hash SHA-256 do token enviado por e-mail.
    *   `userId` (Int): FK para `User`.
    *   `expiresAt` (DateTime): Validade do token.
    *   `usedAt` (DateTime?): Data de uso (se aplicável).
*   **Relacionamentos:** `onDelete: Cascade` com a tabela `User`.
*   **Índices:** Índice composto em `tokenHash` e `userId` para buscas rápidas.

### 3.3 Tabela: `RouteCache`
**Status:** Legada e mantida temporariamente apenas para compatibilidade do schema. O fluxo de jornadas não lê nem grava mais nesta tabela; desde a ADR-015, o cache de rotas reside na memória do backend.
*   **Campos:**
    *   `id` (Int): Chave primária.
    *   `cacheKey` (String): Hash único baseado em origem, destino e preferências.
    *   `googleResponse` (Json): Resposta bruta convertida do Google.
    *   `timePreference` (Json?): Preferências de horário usadas na busca.
    *   `expiresAt` (DateTime): Data de expiração do cache.
*   **Índices:** `@unique` no campo `cacheKey`.

### 3.4 Tabela: `ApiUsage`
**Finalidade:** Auditoria e controle de limites de uso (Daily Journey Limit).
*   **Campos:**
    *   `id` (Int): Chave primária.
    *   `userId` (Int?): FK opcional para `User`.
    *   `ipAddress` (String): Endereço IP do solicitante.
    *   `endpoint` (String): Rota acessada.
    *   `createdAt` (DateTime): Data da requisição.
*   **Relacionamentos:** `onDelete: SetNull` com a tabela `User` (Mantém a auditoria para proteção financeira mesmo após deleção do usuário).
*   **Índices:** Índices em `userId`, `ipAddress` e `createdAt`.

---

## 4. Estratégias de Dados

### 4.1 Proteção Financeira (Cache)
O backend mantém respostas de rotas idênticas em memória por **2 minutos**. Isso evita cobranças duplicadas em buscas imediatamente repetidas sem adicionar tráfego ao PostgreSQL. O conteúdo é descartado em reinicializações e não é compartilhado entre instâncias do backend.

### 4.2 Controle de Uso
A tabela `ApiUsage` contabiliza chamadas externas de rota concluídas com sucesso. Respostas do cache e falhas não são registradas. O `dailyJourneyLimit` bloqueia a partir de 10 chamadas por usuário ou IP desde a meia-noite no fuso horário do processo do backend.

---

## 5. Segurança e Privacidade

*   **Hashes:** Senhas são processadas via Bcrypt antes da persistência. Tokens de reset são armazenados como hash SHA-256.
*   **Chaves de API:** Proibido o armazenamento de chaves de API do Google ou segredos do JWT no banco de dados.
*   **LGPD:** A deleção de conta do usuário (`DELETE /users/me`) remove os dados de identificação (`User` e `PasswordResetToken`), enquanto os registros de `ApiUsage` são anonimizados (`SetNull`), preservando a integridade dos logs de custo.

---

## 6. Evoluções Futuras (Planejado)

*   **`ConversationSession`:** Implementada para manter o estado atual de um diálogo voice-first com TTL deslizante.
*   **`ConversationTurn`:** Histórico de falas (transcrições) de uma sessão.
*   **`CityConfig / LocalIntelligence`:** Persistência de aliases e regras por cidade (Uberaba, etc.).
*   **`AuditLog` / `ProviderUsageLog`:** Logs mais granulares para monitoramento de erros de APIs externas.

---

## 7. Pendências de Confirmação

*   [ ] **Limpeza:** Existe algum job (Cron) para remover registros antigos de `ApiUsage`?
*   [ ] **Deleção Física:** Confirmar se o sistema utiliza apenas deleção física ou se há planos para Soft Delete (`deletedAt`).

---
*Documento gerado como base técnica para a gestão de dados do ecossistema Nuvem.*
