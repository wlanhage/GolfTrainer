import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { canUsePush } from './push';

// ---------------------------------------------------------------------------
// Helpers to mock browser globals
// ---------------------------------------------------------------------------

type NavigatorOverride = Partial<Pick<Navigator, 'userAgent'>> & {
  serviceWorker?: unknown;
  standalone?: boolean;
};

function mockBrowser(navigator: NavigatorOverride, windowExtra: Record<string, unknown> = {}) {
  Object.defineProperty(global, 'navigator', {
    configurable: true,
    writable: true,
    value: {
      userAgent: navigator.userAgent ?? 'Mozilla/5.0 Chrome/120',
      ...(navigator.serviceWorker !== undefined ? { serviceWorker: navigator.serviceWorker } : {}),
      ...(navigator.standalone !== undefined ? { standalone: navigator.standalone } : {})
    }
  });

  Object.defineProperty(global, 'window', {
    configurable: true,
    writable: true,
    value: {
      matchMedia: (query: string) => ({
        matches: query === '(display-mode: standalone)' ? (windowExtra.standalone === true) : false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false
      }),
      PushManager: windowExtra.PushManager,
      navigator: global.navigator
    }
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('canUsePush', () => {
  const originalNavigator = global.navigator;
  const originalWindow = global.window;

  afterEach(() => {
    Object.defineProperty(global, 'navigator', { configurable: true, writable: true, value: originalNavigator });
    Object.defineProperty(global, 'window', { configurable: true, writable: true, value: originalWindow });
  });

  it('returns supported=true on a desktop Chrome-like environment', () => {
    mockBrowser(
      {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
        serviceWorker: {}
      },
      { PushManager: function PushManager() {} }
    );

    const result = canUsePush();
    expect(result.supported).toBe(true);
    expect(result.needsInstall).toBe(false);
  });

  it('returns needsInstall=true on iOS Safari (non-standalone, no PushManager)', () => {
    mockBrowser(
      {
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
        serviceWorker: {}
        // no standalone property = undefined => not standalone
      },
      {
        // PushManager absent — as in iOS Safari regular tab before iOS 16.4
        standalone: false
      }
    );

    const result = canUsePush();
    expect(result.supported).toBe(false);
    expect(result.needsInstall).toBe(true);
    if (!result.supported) {
      expect(result.reason).toBe('ios-needs-install');
    }
  });

  it('returns supported=false and needsInstall=false when serviceWorker is missing', () => {
    mockBrowser(
      {
        userAgent: 'Mozilla/5.0 (Android; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0'
        // serviceWorker intentionally absent
      },
      { PushManager: function PushManager() {} }
    );

    const result = canUsePush();
    expect(result.supported).toBe(false);
    expect(result.needsInstall).toBe(false);
    if (!result.supported) {
      expect(result.reason).toBe('no-service-worker');
    }
  });
});
