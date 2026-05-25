/**
 * Maps backend AI error codes to i18n keys for user-friendly messages.
 *
 * The backend returns errors like:
 *   "Request failed: 503 — AI_RATE_LIMITED: AI model is rate limited"
 *
 * This helper extracts the error code and maps it to a friendly i18n key.
 */

const CODE_TO_I18N: Record<string, string> = {
  AI_RATE_LIMITED: 'ai.error.rateLimited',
  AI_QUOTA_EXCEEDED: 'ai.error.quotaExceeded',
  AI_TIMEOUT: 'ai.error.timeout',
  AI_UNAVAILABLE: 'ai.error.unavailable',
  AI_MODEL_NOT_FOUND: 'ai.error.modelNotFound',
  AI_NOT_CONFIGURED: 'ai.error.notConfigured',
  AI_ERROR: 'ai.error.generic',
};

/**
 * Given an Error thrown by the API client, return the matching i18n key.
 * Falls back to 'ai.error.generic' if no code is recognized.
 */
export function getAiErrorKey(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);

  for (const code of Object.keys(CODE_TO_I18N)) {
    if (message.includes(code)) {
      return CODE_TO_I18N[code];
    }
  }

  // Check for common network errors
  if (message.includes('AbortError') || message.includes('timeout') || message.includes('network')) {
    return 'ai.error.timeout';
  }

  return 'ai.error.generic';
}
