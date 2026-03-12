# Data model outline

This is a practical model split for analytics-ready product development.

## Core entities

### Auth & profile

- `users`
- `user_profiles`
- `refresh_tokens`

### Training domain

- `training_sessions`
- `drills`
- `drill_attempts`
- `shot_entries`

### Club domain

- `clubs`
- `user_clubs`
- `user_club_distance_samples`
- `user_club_distance_stats`

### Stats/recommendation prep

- `user_stat_snapshots`
- `recommendation_events`

## Raw data vs computed data

### Raw (source of truth)

- Shot entries
- Distance samples
- Drill attempts
- Practice sessions

### Computed (rebuildable read models)

- Club distance stats
- Periodic stat snapshots
- Future feature/recommendation tables

## Indexing and ownership rules

- Index user-scoped filters (`userId`, date/timestamp fields).
- Treat all user data as private and always query with `userId` scoping.
