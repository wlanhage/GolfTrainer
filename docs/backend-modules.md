# Backend modules (MVP)

## Planned/active modules

1. **Auth**
   - Register, login, token refresh, logout
   - Password hashing + refresh token rotation

2. **Users**
   - Profile management (name, handedness, goals, handicap)

3. **Clubs**
   - User clubs and club-specific distance metrics

4. **Practice sessions**
   - Session start/end, focus area, session notes

5. **Drills**
   - Drill catalog and drill attempt records

6. **Shots**
   - Individual shot entries (club, distance, lie, outcome)

7. **Stats**
   - Aggregates and trends over time

## Why this split

- Keeps each domain focused and testable.
- Makes APIs easier to evolve feature-by-feature.
- Supports a clean service/repository boundary per module.
