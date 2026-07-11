-- CreateEnum
CREATE TYPE "GreenCandidateStatus" AS ENUM ('OPEN', 'ASSIGNED');

-- CreateTable
CREATE TABLE "GreenCandidate" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "polygon" JSONB NOT NULL,
    "forHoles" INTEGER[],
    "source" TEXT NOT NULL,
    "status" "GreenCandidateStatus" NOT NULL DEFAULT 'OPEN',
    "assignedHoleNumber" INTEGER,
    "confirmedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GreenCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GreenCandidate_courseId_status_idx" ON "GreenCandidate"("courseId", "status");

-- AddForeignKey
ALTER TABLE "GreenCandidate" ADD CONSTRAINT "GreenCandidate_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
