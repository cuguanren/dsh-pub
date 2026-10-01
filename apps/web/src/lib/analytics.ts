import { loadTurnstile } from './turnstile.js';

export async function initializeAnalytics(container: HTMLElement) {
  const measurementId = container.dataset.measurementId;
  if (!measurementId || !/^G-[A-Z0-9]+$/.test(measurementId)) return;
  const landing = { page_location: location.href, page_referrer: document.referrer };
  let started = false;
  let verifying = false;
  const failed = () => {
    container.dataset.analyticsState = 'unverified';
  };
  container.dataset.analyticsState = 'pending';
  try {
    const response = await fetch('/api/analytics-config', { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error('Analytics verification is unavailable.');
    const config = await response.json();
    if (typeof config.turnstileSiteKey !== 'string' || !config.turnstileSiteKey) {
      throw new Error('Analytics verification is not configured.');
    }
    const turnstile = await loadTurnstile();
    turnstile.render(container, {
      sitekey: config.turnstileSiteKey,
      action: 'analytics',
      appearance: 'interaction-only',
      retry: 'never',
      'refresh-expired': 'never',
      'error-callback': failed,
      'expired-callback': failed,
      callback: (token) => {
        if (started || verifying) return;
        verifying = true;
        void (async () => {
          try {
            const verification = await fetch('/api/analytics-verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token }),
              signal: AbortSignal.timeout(15_000),
            });
            if (!verification.ok || (await verification.json()).verified !== true) {
              throw new Error('Analytics verification failed.');
            }
            started = true;
            const analyticsGlobal = globalThis as typeof globalThis & { dataLayer?: unknown[] };
            analyticsGlobal.dataLayer ??= [];
            // gtag expects arguments objects in dataLayer, not ordinary arrays.
            const gtag: (...args: unknown[]) => void = function () {
              // eslint-disable-next-line prefer-rest-params -- Required by the gtag queue format.
              analyticsGlobal.dataLayer!.push(arguments);
            };
            gtag('js', new Date());
            gtag('config', measurementId, { ...landing, traffic_verification: 'turnstile' });
            const script = document.createElement('script');
            script.async = true;
            script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
            document.head.append(script);
            container.dataset.analyticsState = 'verified';
          } catch {
            failed();
          } finally {
            verifying = false;
          }
        })();
      },
    });
  } catch {
    failed();
  }
}
