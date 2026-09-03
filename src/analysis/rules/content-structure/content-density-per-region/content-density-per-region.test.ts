import { describe, it, expect } from 'vitest';
import { ContentDensityPerRegionRule } from './content-density-per-region';
import { mockContext } from '../../test-fixtures';
import type { NavigationStep } from '../../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

const rule = new ContentDensityPerRegionRule();

const createStep = (
    index: number,
    overrides: Partial<{ focusedElementText: string; spokenPhrases: string[]; role: string }> = {}
): NavigationStep => ({
    index,
    identifier: `step-${index}`,
    spokenPhrases: overrides.spokenPhrases ?? [overrides.focusedElementText ?? `Item ${index}`],
    focusedElementText: overrides.focusedElementText ?? `Item ${index}`,
    focusedElementTextLog: [],
    timestamp: 1_700_000_000_000 + index,
    axNode: overrides.role ? ({ nodeId: `${index}`, role: { value: overrides.role } } as never) : undefined,
    htmlSnippet: null,
});

const arrowResult = (navigationSteps: NavigationStep[]) =>
    mockContext([
        {
            meta: { name: 'arrow', description: 'Linear reading', mode: 'browse' },
            navigationSteps,
            completionReason: { kind: 'exhausted', detail: 'reached end of document' },
        },
    ]);

describe('content-density-per-region rule', () => {
    it('has correct metadata', () => {
        expect(rule.id).toBe('content-density-per-region');
        expect(rule.meta.impact).toBe('moderate');
        expect(rule.meta.wcag.primary.criterion).toBe('2.4.1');
    });

    it('records dense navigation regions but leaves the violation to navigation-size', async () => {
        const steps = [createStep(0, { focusedElementText: 'navigation landmark' })];
        for (let i = 1; i <= 60; i++) {
            steps.push(createStep(i, { focusedElementText: `Nav link ${i}` }));
        }
        const customRule = new ContentDensityPerRegionRule({ threshold: 50 });

        const result = await customRule.run(arrowResult(steps));

        expect(result.stats!.regions[0]).toMatchObject({ landmark: 'navigation', exceedsThreshold: true });
        expect(result.violations).toHaveLength(0);
    });

    it('reports dense non-navigation regions', async () => {
        const steps = [createStep(0, { focusedElementText: 'main landmark' })];
        for (let i = 1; i <= 60; i++) {
            steps.push(createStep(i, { focusedElementText: `Content ${i}` }));
        }
        const customRule = new ContentDensityPerRegionRule({ threshold: 50 });

        const result = await customRule.run(arrowResult(steps));

        expect(result.violations.map((v) => v.rule.id)).toEqual(['content-density-per-region']);
    });

    it('stays silent when regions are under threshold', async () => {
        const steps = [
            createStep(0, { focusedElementText: 'main landmark' }),
            ...Array.from({ length: 20 }, (_, i) => createStep(i + 1, { focusedElementText: `Item ${i}` })),
        ];

        const result = await rule.run(arrowResult(steps));

        expect(result.violations).toHaveLength(0);
    });

    it('skips analysis when no arrow strategy ran', async () => {
        const result = await rule.run(mockContext([]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.regions).toEqual([]);
    });
});
