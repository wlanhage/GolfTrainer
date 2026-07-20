-- Reaktioner riktas mot en spelares score (RoundPlayer) i stället för hela
-- rundan. Befintliga rundnivå-reaktioner kan inte mappas till en spelare,
-- så de rensas (featuren är nyss lanserad).

DELETE FROM "RoundReaction";

-- AlterTable
ALTER TABLE "RoundReaction" ADD COLUMN "playerId" TEXT NOT NULL;

-- DropIndex
DROP INDEX "RoundReaction_roundId_userId_key";

-- CreateIndex
CREATE UNIQUE INDEX "RoundReaction_playerId_userId_key" ON "RoundReaction"("playerId", "userId");

-- CreateIndex
CREATE INDEX "RoundReaction_roundId_idx" ON "RoundReaction"("roundId");

-- AddForeignKey
ALTER TABLE "RoundReaction" ADD CONSTRAINT "RoundReaction_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "RoundPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
