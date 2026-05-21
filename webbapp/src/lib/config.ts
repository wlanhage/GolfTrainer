const explicit = process.env.NEXT_PUBLIC_API_URL;
const isProd = process.env.NODE_ENV === 'production';

if (isProd && !explicit) {
  // Fail loudly i prod — bättre crash än tysta requests till localhost
  throw new Error(
    'NEXT_PUBLIC_API_URL saknas. Sätt env-variabeln innan deploy: NEXT_PUBLIC_API_URL=https://api.example.com/api/v1'
  );
}

export const API_BASE_URL = explicit ?? 'http://localhost:3000/api/v1';
// 45s tolerates Render free-tier cold-starts (~30s). Without this, the first
// request after idle (typically login) times out before the server wakes up.
export const REQUEST_TIMEOUT_MS = 45000;
