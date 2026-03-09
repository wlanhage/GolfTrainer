# Auth implementation (Fastify + TypeScript + Prisma)

Denna implementation täcker:
- register
- login
- refresh token
- logout
- protected routes
- hashade lösenord
- JWT access + refresh

## 1) Auth-design (enkel men produktionsnära)

- **Access token (JWT):** kort livslängd (15m), skickas i `Authorization: Bearer`.
- **Refresh token (JWT):** längre livslängd (30d), roteras vid refresh.
- **Refresh tokens lagras hashade i DB** (`sha256(token)`), aldrig i klartext.
- **Argon2id** för lösenordshash.
- **Token rotation:** gammal refresh token markeras `revokedAt` vid varje refresh.
- **All user-data är owner-scopad** i repositories via `where: { userId, ... }`.

## 2) Nödvändiga modeller/tabeller

Auth kräver minst:
- `User` (`email`, `passwordHash`, timestamps)
- `UserProfile` (1-1 med User)
- `RefreshToken`:
  - `userId`
  - `tokenId` (JWT `jti`, unique)
  - `tokenHash` (unique)
  - `expiresAt`
  - `revokedAt` / `revokedReason`
  - `ip` / `userAgent`

Se implementation i `prisma/schema.prisma`.

## 3) Endpoint-exempel

Prefix `/api/v1/auth`:
- `POST /register`
- `POST /login`
- `POST /refresh`
- `POST /logout`

Skyddad endpoint-exempel:
- `GET /api/v1/users/me` med auth middleware.

## 4) Middleware för protected routes

- Läs Bearer-token.
- Verifiera access-secret + expiry.
- Säkerställ `type === 'access'`.
- Sätt `request.auth.userId`.
- Avvisa med 401 vid fel.

Se `backend/src/common/middleware/auth.middleware.ts`.

## 5) Refresh token-flöde

1. Klient kallar `/auth/refresh` med refresh token.
2. Backend verifierar JWT signatur/exp.
3. Backend hashar token och matchar mot aktiv (`revokedAt IS NULL`) rad i DB.
4. Om match:
   - markera gammal token revoked
   - skapa ny access + ny refresh
   - spara ny refresh-hash i DB
5. Returnera nytt tokenpar.

Logout:
- hash + slå upp token, markera revoked.

## 6) Controller/service-kod

Referenser:
- Controller: `backend/src/modules/auth/auth.controller.ts`
- Service: `backend/src/modules/auth/auth.service.ts`
- Repository: `backend/src/modules/auth/auth.repository.ts`
- Routes: `backend/src/modules/auth/auth.routes.ts`
- Protected route example: `backend/src/modules/users/users.routes.ts`

