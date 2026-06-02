-- CreateTable
CREATE TABLE "RouteCache" (
    "id" SERIAL NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "googleResponse" JSONB NOT NULL,
    "timePreference" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RouteCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RouteCache_cacheKey_key" ON "RouteCache"("cacheKey");

-- CreateIndex
CREATE INDEX "RouteCache_cacheKey_idx" ON "RouteCache"("cacheKey");
