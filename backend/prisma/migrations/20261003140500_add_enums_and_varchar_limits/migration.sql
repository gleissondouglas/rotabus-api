-- CreateEnum Role
DO $$ BEGIN
    CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum SessionState com todos os 7 estados da FSM do RotaBus
DO $$ BEGIN
    CREATE TYPE "SessionState" AS ENUM (
        'IDLE',
        'WAITING_DESTINATION',
        'WAITING_DESTINATION_SELECTION',
        'WAITING_CONFIRMATION',
        'WAITING_TIME_SELECTION',
        'JOURNEY_DISPLAYED',
        'ERROR'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- DropIndex
DROP INDEX IF EXISTS "PasswordResetToken_tokenHash_idx";

-- Normalização defensiva da coluna role em User
UPDATE "User" SET "role" = 'USER' WHERE "role" IS NULL OR "role" NOT IN ('USER', 'ADMIN');

-- AlterTable User
ALTER TABLE "User" 
  ALTER COLUMN "name" SET DATA TYPE VARCHAR(100),
  ALTER COLUMN "email" SET DATA TYPE VARCHAR(254),
  ALTER COLUMN "pushToken" SET DATA TYPE VARCHAR(200),
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "Role" USING "role"::"Role",
  ALTER COLUMN "role" SET DEFAULT 'USER';

-- Normalização defensiva da coluna currentState em ConversationSession
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

-- AlterTable ConversationSession
ALTER TABLE "ConversationSession" 
  ALTER COLUMN "currentState" DROP DEFAULT,
  ALTER COLUMN "currentState" TYPE "SessionState" USING "currentState"::"SessionState",
  ALTER COLUMN "currentState" SET DEFAULT 'IDLE';

-- AlterTable RouteCache
ALTER TABLE "RouteCache" ALTER COLUMN "cacheKey" SET DATA TYPE VARCHAR(512);

-- AlterTable ApiUsage
ALTER TABLE "ApiUsage" 
  ALTER COLUMN "ipAddress" SET DATA TYPE VARCHAR(45),
  ALTER COLUMN "endpoint" SET DATA TYPE VARCHAR(100);

-- AlterTable UserFavorite
ALTER TABLE "UserFavorite" 
  ALTER COLUMN "name" SET DATA TYPE VARCHAR(200),
  ALTER COLUMN "address" SET DATA TYPE VARCHAR(500);

-- AlterTable SearchHistory
ALTER TABLE "SearchHistory" 
  ALTER COLUMN "query" SET DATA TYPE VARCHAR(500),
  ALTER COLUMN "address" SET DATA TYPE VARCHAR(500);

-- Deduplicação preventiva em PasswordResetToken
DELETE FROM "PasswordResetToken" a USING "PasswordResetToken" b
WHERE a.id < b.id AND a."tokenHash" = b."tokenHash";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
