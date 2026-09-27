import { describe, expect, it } from 'vitest';

import { marketplaceEntries } from './catalog.js';
import { useCaseCounts, useCaseFor, useCaseIds, useCaseLabel } from './use-cases.js';

const bySlug = new Map(marketplaceEntries.map((entry) => [entry.slug, entry]));

function useCaseOfSlug(slug: string) {
  const entry = bySlug.get(slug);
  if (!entry) return undefined;
  return useCaseFor(entry);
}

function expectUseCase(slug: string, expected: string) {
  const actual = useCaseOfSlug(slug);
  if (actual === undefined) return;
  expect(actual).toBe(expected);
}

describe('use-case classification', () => {
  it('assigns every catalog record exactly one known use case', () => {
    const assigned = marketplaceEntries.map((entry) => useCaseFor(entry));
    expect(assigned).toHaveLength(marketplaceEntries.length);
    expect(assigned.every((id) => useCaseIds.includes(id))).toBe(true);
  });

  it('reads package names as whole tokens so a substring cannot pick the bucket', () => {
    // `bot` inside `bottom`, `store` inside `plugin-store`, and `browser` inside
    // `plugin-browser` each used to hijack the classification.
    expectUseCase('dsh-bottom-stats', 'usage-cost');
    expectUseCase('dsh-plugin-store', 'runtime-core');
    expectUseCase('dsh-plugin-browser', 'runtime-core');
  });

  it('routes representative community plugins to the use case a reader would expect', () => {
    expectUseCase('dsh-open-in-vscode', 'dev-code');
    expectUseCase('dsh-cc-tui', 'dev-code');
    expectUseCase('dsh-skin', 'ui-surface');
    expectUseCase('dsh-minigames', 'ui-surface');
    expectUseCase('dsh-notification', 'ui-surface');
    expectUseCase('dsh-at-file', 'ui-surface');
    expectUseCase('dsh-vision', 'vision-media');
    expectUseCase('dsh-tavily-search', 'browser-web');
    expectUseCase('dsh-feishu', 'integrations');
    expectUseCase('dsh-wallet', 'usage-cost');
    expectUseCase('dsh-task-memory', 'memory-context');
    expectUseCase('dsh-mcp-manager', 'agent-tools');
    expectUseCase('dsh-automation', 'automation');
  });

  it('reads the phrasings this ecosystem repeats instead of giving up on them', () => {
    // Domain toolkits, Web UI surfaces, and plugin-management plugins are the three
    // shapes that dominated the unclassified tail.
    expectUseCase('dsh-pdf', 'agent-tools');
    expectUseCase('dsh-plugin-finance-data', 'agent-tools');
    expectUseCase('dsh-eyecare', 'ui-surface');
    expectUseCase('dsh-custom-wallpaper', 'ui-surface');
    expectUseCase('dsh-auto-collapse', 'ui-surface');
    expectUseCase('dshp', 'runtime-core');
    expectUseCase('dsh-nanobananapro', 'vision-media');
    expectUseCase('dsh-read-url', 'browser-web');
    expectUseCase('dsh-batch-regression', 'automation');
  });

  it('leaves the unclassified tail small enough to be an honest bucket', () => {
    // Descriptions that stay vague belong in `other`; a classifier that guesses
    // instead would put a confidently wrong label on the home page.
    const described = marketplaceEntries.filter(
      (entry) =>
        !/is an automatically discovered DeepSeek Harness plugin bundle\.?$/iu.test(
          entry.description.en.trim(),
        ),
    );
    const other = described.filter((entry) => useCaseFor(entry) === 'other');
    expect(other.length / described.length).toBeLessThan(0.15);
  });

  it('exposes bilingual labels for every use case', () => {
    for (const id of useCaseIds) {
      expect(useCaseLabel(id, 'en')).not.toHaveLength(0);
      expect(useCaseLabel(id, 'zh')).not.toHaveLength(0);
    }
  });

  it('counts use cases in descending order without inventing empty buckets', () => {
    const counts = useCaseCounts(marketplaceEntries);
    expect(counts.every(({ count }) => count > 0)).toBe(true);
    expect(counts.reduce((total, { count }) => total + count, 0)).toBe(marketplaceEntries.length);
    const values = counts.map(({ count }) => count);
    expect([...values].sort((left, right) => right - left)).toEqual(values);
  });
});
