-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "SessionState" AS ENUM ('IDLE', 'WAITING_DESTINATION', 'WAITING_CONFIRMATION', 'WAITING_TIME_SELECTION', 'JOURNEY_DISPLAYED');

-- DropIndex
DROP INDEX IF EXISTS "PasswordResetToken_tokenHash_idx";

-- AlterTable
ALTER TABLE "User" 
  ALTER COLUMN "name" SET DATA TYPE VARCHAR(100),
  ALTER COLUMN "email" SET DATA TYPE VARCHAR(254),
  ALTER COLUMN "pushToken" SET DATA TYPE VARCHAR(200),
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "Role" USING "role"::"Role",
  ALTER COLUMN "role" SET DEFAULT 'USER';

-- AlterTable
ALTER TABLE "ConversationSession" 
  ALTER COLUMN "currentState" DROP DEFAULT,
  ALTER COLUMN "currentState" TYPE "SessionState" USING "currentState"::"SessionState",
  ALTER COLUMN "currentState" SET DEFAULT 'IDLE';

-- AlterTable
ALTER TABLE "RouteCache" ALTER COLUMN "cacheKey" SET DATA TYPE VARCHAR(512);

-- AlterTable
ALTER TABLE "ApiUsage" 
  ALTER COLUMN "ipAddress" SET DATA TYPE VARCHAR(45),
  ALTER COLUMN "endpoint" SET DATA TYPE VARCHAR(100);

-- AlterTable
ALTER TABLE "UserFavorite" 
  ALTER COLUMN "name" SET DATA TYPE VARCHAR(200),
  ALTER COLUMN "address" SET DATA TYPE VARCHAR(500);

-- AlterTable
ALTER TABLE "SearchHistory" 
  ALTER COLUMN "query" SET DATA TYPE VARCHAR(500),
  ALTER COLUMN "address" SET DATA TYPE VARCHAR(500);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
