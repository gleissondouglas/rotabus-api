-- 1. Converte colunas temporariamente para TEXT caso algum tipo enum parcial já exista
ALTER TABLE "ConversationSession" ALTER COLUMN "currentState" DROP DEFAULT;
ALTER TABLE "ConversationSession" ALTER COLUMN "currentState" TYPE TEXT;

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE TEXT;

-- 2. Remove tipos de enums antigos/parciais para recriá-los com todos os valores corretos
DROP TYPE IF EXISTS "SessionState";
DROP TYPE IF EXISTS "Role";

-- 3. Cria os novos enums completos
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

CREATE TYPE "SessionState" AS ENUM (
    'IDLE',
    'WAITING_DESTINATION',
    'WAITING_DESTINATION_SELECTION',
    'WAITING_CONFIRMATION',
    'WAITING_TIME_SELECTION',
    'JOURNEY_DISPLAYED',
    'ERROR'
);

-- 4. Normalização defensiva de dados legados antes do cast
UPDATE "User" 
SET "role" = 'USER' 
WHERE "role" IS NULL OR "role" NOT IN ('USER', 'ADMIN');

UPDATE "ConversationSession" 
SET "currentState" = 'IDLE' 
WHERE "currentState" IS NULL 
   OR "currentState" NOT IN (
       'IDLE',
       'WAITING_DESTINATION',
       'WAITING_DESTINATION_SELECTION',
       'WAITING_CONFIRMATION',
       'WAITING_TIME_SELECTION',
       'JOURNEY_DISPLAYED',
       'ERROR'
   );

-- 5. Aplica limites de tamanho e converte para os novos Enums
ALTER TABLE "User" 
  ALTER COLUMN "name" SET DATA TYPE VARCHAR(100),
  ALTER COLUMN "email" SET DATA TYPE VARCHAR(254),
  ALTER COLUMN "pushToken" SET DATA TYPE VARCHAR(200),
  ALTER COLUMN "role" TYPE "Role" USING "role"::"Role",
  ALTER COLUMN "role" SET DEFAULT 'USER';

ALTER TABLE "ConversationSession" 
  ALTER COLUMN "currentState" TYPE "SessionState" USING "currentState"::"SessionState",
  ALTER COLUMN "currentState" SET DEFAULT 'IDLE';

-- 6. Limites de tamanho nas demais tabelas
ALTER TABLE "RouteCache" ALTER COLUMN "cacheKey" SET DATA TYPE VARCHAR(512);

ALTER TABLE "ApiUsage" 
  ALTER COLUMN "ipAddress" SET DATA TYPE VARCHAR(45),
  ALTER COLUMN "endpoint" SET DATA TYPE VARCHAR(100);

ALTER TABLE "UserFavorite" 
  ALTER COLUMN "name" SET DATA TYPE VARCHAR(200),
  ALTER COLUMN "address" SET DATA TYPE VARCHAR(500);

ALTER TABLE "SearchHistory" 
  ALTER COLUMN "query" SET DATA TYPE VARCHAR(500),
  ALTER COLUMN "address" SET DATA TYPE VARCHAR(500);

-- 7. Ajustes na PasswordResetToken (índice único)
DROP INDEX IF EXISTS "PasswordResetToken_tokenHash_idx";

DELETE FROM "PasswordResetToken" a USING "PasswordResetToken" b
WHERE a.id < b.id AND a."tokenHash" = b."tokenHash";

CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
