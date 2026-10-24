-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "personaName" TEXT,
    "avatarUrl" TEXT,
    "rankTier" INTEGER,
    "initialMmr" INTEGER NOT NULL,
    "estimatedMmr" INTEGER NOT NULL,
    "personalBestMmr" INTEGER NOT NULL,
    "lastSyncedMatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "heroId" INTEGER,
    "heroName" TEXT,
    "result" TEXT NOT NULL,
    "isRanked" BOOLEAN NOT NULL DEFAULT false,
    "mmrChange" INTEGER NOT NULL DEFAULT 0,
    "kills" INTEGER,
    "deaths" INTEGER,
    "assists" INTEGER,
    "duration" INTEGER,
    "gpm" INTEGER,
    "xpm" INTEGER,
    "lastHits" INTEGER,
    "denies" INTEGER,
    "lane" TEXT,
    "items" JSONB,
    "goldTimeline" JSONB,
    "lhTimeline" JSONB,
    "xpTimeline" JSONB,
    "playedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankSnapshot" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "rankTier" INTEGER,
    "estimatedMmr" INTEGER NOT NULL,
    "capturedOn" DATE NOT NULL,

    CONSTRAINT "RankSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_accountId_key" ON "Player"("accountId");

-- CreateIndex
CREATE INDEX "Player_createdAt_idx" ON "Player"("createdAt");

-- CreateIndex
CREATE INDEX "Match_playerId_playedAt_idx" ON "Match"("playerId", "playedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Match_playerId_matchId_key" ON "Match"("playerId", "matchId");

-- CreateIndex
CREATE INDEX "RankSnapshot_playerId_capturedOn_idx" ON "RankSnapshot"("playerId", "capturedOn");

-- CreateIndex
CREATE UNIQUE INDEX "RankSnapshot_playerId_capturedOn_key" ON "RankSnapshot"("playerId", "capturedOn");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankSnapshot" ADD CONSTRAINT "RankSnapshot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
