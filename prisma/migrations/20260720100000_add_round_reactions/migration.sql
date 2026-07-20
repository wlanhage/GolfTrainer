-- CreateTable
CREATE TABLE "RoundReaction" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoundReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoundReaction_roundId_userId_key" ON "RoundReaction"("roundId", "userId");

-- CreateIndex
CREATE INDEX "RoundReaction_userId_idx" ON "RoundReaction"("userId");

-- AddForeignKey
ALTER TABLE "RoundReaction" ADD CONSTRAINT "RoundReaction_roundId_fkey"
  FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundReaction" ADD CONSTRAINT "RoundReaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
