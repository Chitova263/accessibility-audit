import { describe, it, expect } from 'vitest';
import { ExcessiveRepetitionRule } from './excessive-repetition';
import { mockContext } from '../../test-fixtures';
import type { NavigationStep } from '../../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

const rule = new ExcessiveRepetitionRule();

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

describe('excessive-repetition rule', () => {
    it('tolerates short runs of repeated announcements by default', async () => {
        const steps = Array.from({ length: 4 }, (_, i) => createStep(i, { focusedElementText: 'Add to basket' }));

        const result = await rule.run(arrowResult(steps));

        expect(result.stats!.threshold).toBe(5);
        expect(result.violations).toHaveLength(0);
    });

    it('reports runs that reach the threshold', async () => {
        const steps = Array.from({ length: 6 }, (_, i) => createStep(i, { focusedElementText: 'Add to basket' }));

        const result = await rule.run(arrowResult(steps));

        expect(result.violations.map((v) => v.rule.id)).toEqual(['excessive-repetition']);
        expect(result.stats!.repetitions[0]!.count).toBe(6);
    });

    it('honours a custom threshold', async () => {
        const steps = Array.from({ length: 3 }, (_, i) => createStep(i, { focusedElementText: 'Add to basket' }));
        const customRule = new ExcessiveRepetitionRule({ threshold: 3 });

        const result = await customRule.run(arrowResult(steps));

        expect(result.violations).toHaveLength(1);
    });

    it('skips analysis when no arrow strategy ran', async () => {
        const result = await rule.run(mockContext([]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.repetitions).toEqual([]);
    });
});
