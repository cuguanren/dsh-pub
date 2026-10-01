import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeAnalytics } from './analytics.js';
import { loadTurnstile, type TurnstileApi } from './turnstile.js';

vi.mock('./turnstile.js', () => ({ loadTurnstile: vi.fn() }));

describe('verified analytics', () => {
  let options: Parameters<TurnstileApi['render']>[1];
  let container: HTMLElement;
  const append = vi.fn();
  const fetcher = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    container = { dataset: { measurementId: 'G-TEST123' } } as unknown as HTMLElement;
    vi.stubGlobal('dataLayer', undefined);
    vi.stubGlobal('location', { href: 'https://dsh.pub/en/?utm_source=test' });
    vi.stubGlobal('document', {
      referrer: 'https://www.google.com/',
      createElement: () => ({}),
      head: { append },
    });
    vi.stubGlobal('fetch', fetcher);
    fetcher.mockImplementation(async (url) =>
      Response.json(
        url === '/api/analytics-config' ? { turnstileSiteKey: 'site-key' } : { verified: true },
      ),
    );
    vi.mocked(loadTurnstile).mockResolvedValue({
      render: (_container, value) => {
        options = value;
        return 'widget';
      },
      reset: vi.fn(),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('loads GA only after backend verification, retaining the landing attribution', async () => {
    let release!: (response: Response) => void;
    fetcher.mockImplementation(async (url) =>
      url === '/api/analytics-config'
        ? Response.json({ turnstileSiteKey: 'site-key' })
        : new Promise<Response>((resolve) => {
            release = resolve;
          }),
    );
    await initializeAnalytics(container);
    expect(options.action).toBe('analytics');
    expect(append).not.toHaveBeenCalled();
    options.callback('token');
    options.callback('duplicate');
    expect(append).not.toHaveBeenCalled();
    release(Response.json({ verified: true }));
    await vi.waitFor(() => expect(append).toHaveBeenCalledOnce());
    options.callback('duplicate');
    expect(append).toHaveBeenCalledOnce();
    const layer = (globalThis as unknown as { dataLayer: IArguments[] }).dataLayer;
    expect(Array.from(layer[1]!)).toEqual([
      'config',
      'G-TEST123',
      {
        page_location: 'https://dsh.pub/en/?utm_source=test',
        page_referrer: 'https://www.google.com/',
        traffic_verification: 'turnstile',
      },
    ]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(container.dataset.analyticsState).toBe('verified');
  });

  it.each([false, 'true', undefined])(
    'never starts GA for unverified backend result %j',
    async (verified) => {
      fetcher.mockImplementation(async (url) =>
        Response.json(
          url === '/api/analytics-config' ? { turnstileSiteKey: 'site-key' } : { verified },
        ),
      );
      await initializeAnalytics(container);
      options.callback('token');
      await vi.waitFor(() => expect(container.dataset.analyticsState).toBe('unverified'));
      expect(append).not.toHaveBeenCalled();
    },
  );

  it('leaves GA off on configuration or script failure', async () => {
    fetcher.mockRejectedValueOnce(new Error('offline'));
    await initializeAnalytics(container);
    expect(container.dataset.analyticsState).toBe('unverified');
    expect(loadTurnstile).not.toHaveBeenCalled();
    vi.mocked(loadTurnstile).mockRejectedValueOnce(new Error('blocked'));
    await initializeAnalytics(container);
    expect(append).not.toHaveBeenCalled();
  });

  it('does not initialize without a valid measurement ID', async () => {
    container.dataset.measurementId = 'bad';
    await initializeAnalytics(container);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('leaves GA off on challenge errors or expiry', async () => {
    await initializeAnalytics(container);
    options['error-callback']();
    options['expired-callback']();
    expect(container.dataset.analyticsState).toBe('unverified');
    expect(append).not.toHaveBeenCalled();
  });
});
