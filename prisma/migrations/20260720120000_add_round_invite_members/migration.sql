-- CreateTable
CREATE TABLE "RoundInviteMember" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoundInviteMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoundInviteMember_inviteId_userId_key" ON "RoundInviteMember"("inviteId", "userId");

-- CreateIndex
CREATE INDEX "RoundInviteMember_userId_idx" ON "RoundInviteMember"("userId");

-- AddForeignKey
ALTER TABLE "RoundInviteMember" ADD CONSTRAINT "RoundInviteMember_inviteId_fkey"
  FOREIGN KEY ("inviteId") REFERENCES "RoundInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundInviteMember" ADD CONSTRAINT "RoundInviteMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
