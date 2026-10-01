import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('shared Turnstile loader', () => {
  const scripts: HTMLScriptElement[] = [];
  beforeEach(() => {
    vi.resetModules();
    scripts.length = 0;
    vi.stubGlobal('turnstile', undefined);
    vi.stubGlobal('document', {
      createElement: () => ({}),
      head: { append: (script: HTMLScriptElement) => scripts.push(script) },
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('shares one in-flight script between analytics and submission', async () => {
    const { loadTurnstile } = await import('./turnstile.js');
    const first = loadTurnstile();
    const second = loadTurnstile();
    expect(scripts).toHaveLength(1);
    const api = { render: vi.fn(), reset: vi.fn() };
    vi.stubGlobal('turnstile', api);
    scripts[0]!.onload!(new Event('load'));
    expect(await first).toBe(api);
    expect(await second).toBe(api);
    expect(await loadTurnstile()).toBe(api);
    expect(scripts).toHaveLength(1);
  });

  it('allows a later retry after a script failure', async () => {
    const { loadTurnstile } = await import('./turnstile.js');
    const first = loadTurnstile();
    const rejected = expect(first).rejects.toThrow('failed to load');
    scripts[0]!.onerror!(new Event('error'));
    await rejected;
    const retry = loadTurnstile();
    expect(scripts).toHaveLength(2);
    const failedInitialization = expect(retry).rejects.toThrow('failed to initialize');
    scripts[1]!.onload!(new Event('load'));
    await failedInitialization;
  });

  it('stops waiting when the network never completes', async () => {
    vi.useFakeTimers();
    const { loadTurnstile } = await import('./turnstile.js');
    const rejected = expect(loadTurnstile()).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(15_000);
    await rejected;
  });
});
