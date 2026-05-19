const explicit = process.env.NEXT_PUBLIC_API_URL;
const isProd = process.env.NODE_ENV === 'production';

if (isProd && !explicit) {
  // Fail loudly i prod — bättre crash än tysta requests till localhost
  throw new Error(
    'NEXT_PUBLIC_API_URL saknas. Sätt env-variabeln innan deploy: NEXT_PUBLIC_API_URL=https://api.example.com/api/v1'
  );
}

export const API_BASE_URL = explicit ?? 'http://localhost:3000/api/v1';
export const REQUEST_TIMEOUT_MS = 10000;
