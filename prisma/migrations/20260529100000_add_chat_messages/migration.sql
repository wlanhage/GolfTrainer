-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_messages_senderId_recipientId_createdAt_idx" ON "chat_messages"("senderId", "recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "chat_messages_recipientId_readAt_idx" ON "chat_messages"("recipientId", "readAt");

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
