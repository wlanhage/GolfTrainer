-- AlterTable: Round.courseId FK from RESTRICT to CASCADE
ALTER TABLE "Round" DROP CONSTRAINT IF EXISTS "Round_courseId_fkey";
ALTER TABLE "Round" ADD CONSTRAINT "Round_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: RoundHole.holeId FK from RESTRICT to CASCADE
ALTER TABLE "RoundHole" DROP CONSTRAINT IF EXISTS "RoundHole_holeId_fkey";
ALTER TABLE "RoundHole" ADD CONSTRAINT "RoundHole_holeId_fkey"
  FOREIGN KEY ("holeId") REFERENCES "Hole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
