-- MVP seed data for the Play module (course creation + rounds + layouts)
-- Replace user id with a valid user in your DB before running.

-- 1) Course
INSERT INTO "Course" (
  "id", "userId", "clubName", "courseName", "teeName", "holeCount", "source", "isDraft", "localOnly", "syncStatus", "createdAt", "updatedAt"
)
VALUES
  ('course_seed_001', 'user_seed_001', 'Stockholm Golfklubb', 'Parkbanan', 'Gul tee', 9, 'MANUAL', false, true, 'PENDING', NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

-- 2) Holes + layouts
INSERT INTO "Hole" ("id", "courseId", "holeNumber", "par", "length", "hcpIndex", "createdAt", "updatedAt")
VALUES
  ('hole_seed_001', 'course_seed_001', 1, 4, 340, 8, NOW(), NOW()),
  ('hole_seed_002', 'course_seed_001', 2, 3, 160, 16, NOW(), NOW()),
  ('hole_seed_003', 'course_seed_001', 3, 5, 470, 2, NOW(), NOW())
ON CONFLICT ("courseId", "holeNumber") DO NOTHING;

INSERT INTO "HoleLayout" (
  "id", "holeId", "teePosition", "greenPosition", "fairwayShape", "waterShapes", "treeShapes", "bunkerShapes", "notes", "mappingStatus", "createdAt", "updatedAt"
)
VALUES
  ('layout_seed_001', 'hole_seed_001', '{"x": 10, "y": 90}', '{"x": 85, "y": 10}', '[]', '[]', '[]', '[]', 'Seed layout', 'PARTIAL', NOW(), NOW())
ON CONFLICT ("holeId") DO NOTHING;

-- 3) In-progress round with snapshots
INSERT INTO "Round" (
  "id", "userId", "courseId", "startedAt", "finishedAt", "currentHoleNumber", "status", "createdOffline", "syncStatus", "teeNameSnapshot", "courseNameSnapshot", "clubNameSnapshot", "createdAt", "updatedAt"
)
VALUES
  ('round_seed_001', 'user_seed_001', 'course_seed_001', NOW(), NULL, 2, 'IN_PROGRESS', true, 'PENDING', 'Gul tee', 'Parkbanan', 'Stockholm Golfklubb', NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "RoundHole" (
  "id", "roundId", "holeId", "holeNumber", "strokes", "parSnapshot", "lengthSnapshot", "hcpIndexSnapshot", "notes", "completedAt", "createdAt", "updatedAt"
)
VALUES
  ('round_hole_seed_001', 'round_seed_001', 'hole_seed_001', 1, 5, 4, 340, 8, 'Första hålet klart', NOW(), NOW(), NOW()),
  ('round_hole_seed_002', 'round_seed_001', 'hole_seed_002', 2, NULL, 3, 160, 16, NULL, NULL, NOW(), NOW())
ON CONFLICT ("roundId", "holeNumber") DO NOTHING;
