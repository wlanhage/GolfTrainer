# Follow System Design (PostgreSQL)

This document defines a one-directional follow model (no friend requests/approvals), plus SQL operations for profile social graphs, followed-only feeds, and followed-only leaderboards.

## 1) Recommended database schema

### Core relationship
- `user_follows.follower_user_id` = user who initiates follow.
- `user_follows.following_user_id` = user being followed.
- Directional edge: `(A -> B)` does not imply `(B -> A)`.

### Integrity rules
- No self-follow (`follower_user_id <> following_user_id`).
- No duplicate edge (`UNIQUE (follower_user_id, following_user_id)`).
- Automatic cleanup on user delete (`ON DELETE CASCADE` for both foreign keys).

## 2) SQL table creation statements

```sql
CREATE TABLE user_follows (
  id                TEXT PRIMARY KEY,
  follower_user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT user_follows_no_self_follow
    CHECK (follower_user_id <> following_user_id),

  CONSTRAINT user_follows_unique_edge
    UNIQUE (follower_user_id, following_user_id)
);
```

> If you use UUID IDs, replace `TEXT` with `UUID`.

## 3) SQL queries for required operations

Below, bind parameters as:
- `$1` = current/authenticated user ID
- `$2` = target user ID
- `$3...` as noted

### 3.1 Follow a user

```sql
INSERT INTO user_follows (id, follower_user_id, following_user_id)
VALUES (gen_random_uuid()::text, $1, $2)
ON CONFLICT (follower_user_id, following_user_id) DO NOTHING
RETURNING id, follower_user_id, following_user_id, created_at;
```

If `RETURNING` yields no row, it was already followed (idempotent behavior).

### 3.2 Unfollow a user

```sql
DELETE FROM user_follows
WHERE follower_user_id = $1
  AND following_user_id = $2;
```

### 3.3 Check if a user follows another user

```sql
SELECT EXISTS (
  SELECT 1
  FROM user_follows
  WHERE follower_user_id = $1
    AND following_user_id = $2
) AS is_following;
```

### 3.4 Get followers of a user

```sql
SELECT
  uf.follower_user_id AS user_id,
  u.username,
  uf.created_at AS followed_at
FROM user_follows uf
JOIN users u ON u.id = uf.follower_user_id
WHERE uf.following_user_id = $1
ORDER BY uf.created_at DESC
LIMIT $2 OFFSET $3;
```

### 3.5 Get users that a user is following

```sql
SELECT
  uf.following_user_id AS user_id,
  u.username,
  uf.created_at AS followed_at
FROM user_follows uf
JOIN users u ON u.id = uf.following_user_id
WHERE uf.follower_user_id = $1
ORDER BY uf.created_at DESC
LIMIT $2 OFFSET $3;
```

### 3.6 Get follower + following counts for a profile

```sql
SELECT
  p.id AS user_id,
  COALESCE(followers.cnt, 0) AS follower_count,
  COALESCE(following.cnt, 0) AS following_count
FROM users p
LEFT JOIN (
  SELECT following_user_id, COUNT(*)::int AS cnt
  FROM user_follows
  GROUP BY following_user_id
) followers
  ON followers.following_user_id = p.id
LEFT JOIN (
  SELECT follower_user_id, COUNT(*)::int AS cnt
  FROM user_follows
  GROUP BY follower_user_id
) following
  ON following.follower_user_id = p.id
WHERE p.id = $1;
```

## 4) Leaderboard queries

Assumes `rounds` has: `id, user_id, course_id, total_score, started_at`.

### 4.1 Leaderboard among followed users

Includes self (`$1`) + users followed by `$1`.

```sql
WITH social_scope AS (
  SELECT following_user_id AS user_id
  FROM user_follows
  WHERE follower_user_id = $1
  UNION
  SELECT $1
)
SELECT
  r.user_id,
  u.username,
  COUNT(*)::int AS rounds_played,
  AVG(r.total_score)::numeric(10,2) AS avg_score,
  MIN(r.total_score) AS best_score,
  MAX(r.started_at) AS last_round_at
FROM rounds r
JOIN social_scope s ON s.user_id = r.user_id
JOIN users u ON u.id = r.user_id
WHERE r.total_score IS NOT NULL
GROUP BY r.user_id, u.username
ORDER BY avg_score ASC, best_score ASC, rounds_played DESC
LIMIT $2 OFFSET $3;
```

### 4.2 Leaderboard among followed users for a specific course

```sql
WITH social_scope AS (
  SELECT following_user_id AS user_id
  FROM user_follows
  WHERE follower_user_id = $1
  UNION
  SELECT $1
)
SELECT
  r.user_id,
  u.username,
  r.course_id,
  COUNT(*)::int AS rounds_played,
  AVG(r.total_score)::numeric(10,2) AS avg_score,
  MIN(r.total_score) AS best_score,
  MAX(r.started_at) AS last_round_at
FROM rounds r
JOIN social_scope s ON s.user_id = r.user_id
JOIN users u ON u.id = r.user_id
WHERE r.course_id = $2
  AND r.total_score IS NOT NULL
GROUP BY r.user_id, u.username, r.course_id
ORDER BY avg_score ASC, best_score ASC, rounds_played DESC
LIMIT $3 OFFSET $4;
```

## 5) Following feed query

Returns recent rounds from users the current user follows.

```sql
SELECT
  r.id AS round_id,
  r.user_id,
  u.username,
  c.course_name AS course,
  r.total_score,
  r.started_at
FROM user_follows uf
JOIN rounds r
  ON r.user_id = uf.following_user_id
JOIN users u
  ON u.id = r.user_id
JOIN courses c
  ON c.id = r.course_id
WHERE uf.follower_user_id = $1
  AND r.total_score IS NOT NULL
ORDER BY r.started_at DESC
LIMIT $2 OFFSET $3;
```

## 6) Recommended indexes

```sql
-- Already covered by UNIQUE, but explicit names make maintenance easier.
CREATE UNIQUE INDEX ux_user_follows_edge
  ON user_follows (follower_user_id, following_user_id);

-- Followers lookup: "who follows user X"
CREATE INDEX ix_user_follows_following_created
  ON user_follows (following_user_id, created_at DESC);

-- Following lookup + feed seed: "who does user X follow"
CREATE INDEX ix_user_follows_follower_created
  ON user_follows (follower_user_id, created_at DESC);

-- Feed query support: recent rounds by followed users
CREATE INDEX ix_rounds_user_started
  ON rounds (user_id, started_at DESC)
  WHERE total_score IS NOT NULL;

-- Followed-only course leaderboard support
CREATE INDEX ix_rounds_course_user_started
  ON rounds (course_id, user_id, started_at DESC)
  WHERE total_score IS NOT NULL;

-- General leaderboard score stats support
CREATE INDEX ix_rounds_user_score_started
  ON rounds (user_id, total_score, started_at DESC)
  WHERE total_score IS NOT NULL;
```

## 7) Service-layer structure (optional)

A minimal service module can expose:

- `followUser(followerUserId, followingUserId)`
  - Validate both users exist.
  - Reject self-follow.
  - Insert edge idempotently.

- `unfollowUser(followerUserId, followingUserId)`
  - Delete edge idempotently.

- `isFollowing(followerUserId, followingUserId)`
  - `SELECT EXISTS`.

- `getFollowers(userId, pagination)`
  - Paginated list + total count.

- `getFollowing(userId, pagination)`
  - Paginated list + total count.

- `getFollowCounts(userId)`
  - follower/following counters for profile headers.

- `getFollowingFeed(userId, pagination)`
  - recent rounds from followed users.

- `getFollowingLeaderboard(userId, opts)`
  - all courses or by course, same ranking strategy as global leaderboard.

## 8) Extensibility notes (without overbuilding)

- **Private profiles**: add `users.is_private BOOLEAN DEFAULT FALSE`; gate feed/leaderboard/profile list queries with access predicate.
- **Rounds visible only to followers**: add `rounds.visibility` enum (`PUBLIC`, `FOLLOWERS`, `PRIVATE`) and filter by viewer relationship.
- **Follow notifications**: insert event row in `notifications` table when a follow edge is created.
- **Feed expansion**: feed can union additional event tables (e.g., new personal best, completed challenge) while keeping follows as the social scope primitive.

This keeps today’s model simple and production-ready while providing clean extension points.

## 9) Flow review and gap checks

After re-running the end-to-end flow, keep these service-level guardrails to avoid silent edge-case behavior:

- `followUser`: reject self-follow and return `404` if the target user does not exist.
- `isFollowing`: return `404` for non-existent target profile IDs (instead of returning `false` for an invalid user).
- `getFollowers` / `getFollowing` / `getFollowCounts`: return `404` when the profile user does not exist, so profile pages can distinguish “empty graph” vs “unknown user”.

These checks preserve clean API semantics while keeping write/delete operations idempotent where appropriate.
