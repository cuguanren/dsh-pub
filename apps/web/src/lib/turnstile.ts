export interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      action: string;
      sitekey: string;
      appearance?: 'interaction-only';
      retry?: 'never';
      'refresh-expired'?: 'never';
      callback(token: string): void;
      'error-callback'(): void;
      'expired-callback'(): void;
    },
  ): string;
  reset(widgetId: string): void;
}

export const turnstileGlobal = globalThis as typeof globalThis & { turnstile?: TurnstileApi };
let loading: Promise<TurnstileApi> | undefined;

// Analytics and plugin submission share one script, but use separate widgets and tokens.
export function loadTurnstile(): Promise<TurnstileApi> {
  if (turnstileGlobal.turnstile) return Promise.resolve(turnstileGlobal.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => reject(new Error('Turnstile load timed out.')), 15_000);
    script.async = true;
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.onload = () => {
      clearTimeout(timer);
      if (turnstileGlobal.turnstile) resolve(turnstileGlobal.turnstile);
      else reject(new Error('Turnstile failed to initialize.'));
    };
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Turnstile failed to load.'));
    };
    document.head.append(script);
  }).catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  return loading;
}
