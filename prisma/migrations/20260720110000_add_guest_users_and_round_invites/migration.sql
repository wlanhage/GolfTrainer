-- AlterTable
ALTER TABLE "User" ADD COLUMN "isGuest" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RoundInvite" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "roundId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoundInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoundInvite_code_key" ON "RoundInvite"("code");

-- CreateIndex
CREATE INDEX "RoundInvite_hostUserId_createdAt_idx" ON "RoundInvite"("hostUserId", "createdAt");

-- CreateIndex
CREATE INDEX "RoundInvite_roundId_idx" ON "RoundInvite"("roundId");

-- AddForeignKey
ALTER TABLE "RoundInvite" ADD CONSTRAINT "RoundInvite_hostUserId_fkey"
  FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundInvite" ADD CONSTRAINT "RoundInvite_roundId_fkey"
  FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;
