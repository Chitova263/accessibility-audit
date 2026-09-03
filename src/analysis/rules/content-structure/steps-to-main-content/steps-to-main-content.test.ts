import { describe, it, expect } from 'vitest';
import { StepsToMainContentRule } from './steps-to-main-content';
import { mockContext } from '../../test-fixtures';
import type { NavigationStep } from '../../../../screen-reader/strategies/navigation-strategy';

const rule = new StepsToMainContentRule();

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
            meta: { name: 'arrow', description: 'Linear reading' },
            navigationSteps,
            completionReason: { kind: 'exhausted', detail: 'reached end of document' },
        },
    ]);

describe('steps-to-main-content rule', () => {
    it('reports a missing main landmark when linear reading never announces one', async () => {
        const result = await rule.run(arrowResult([createStep(0), createStep(1)]));

        expect(result.stats!.mainFound).toBe(false);
        expect(result.violations.map((v) => v.rule.id)).toEqual(['missing-main-landmark']);
    });

    it('does not report a missing main landmark when there are no steps to read', async () => {
        const result = await rule.run(arrowResult([]));

        expect(result.violations).toHaveLength(0);
    });

    it('stays silent when main is reached within the threshold', async () => {
        const steps = Array.from({ length: 5 }, (_, i) => createStep(i));
        steps.push(createStep(5, { role: 'main' }));
        const customRule = new StepsToMainContentRule({ threshold: 30 });

        const result = await customRule.run(arrowResult(steps));

        expect(result.stats!.mainFound).toBe(true);
        expect(result.stats!.stepsToMain).toBe(5);
        expect(result.violations).toHaveLength(0);
    });

    it('reports excessive steps when main is reached beyond the threshold', async () => {
        const steps = Array.from({ length: 10 }, (_, i) => createStep(i));
        steps.push(createStep(10, { role: 'main' }));
        const customRule = new StepsToMainContentRule({ threshold: 3 });

        const result = await customRule.run(arrowResult(steps));

        expect(result.violations.map((v) => v.rule.id)).toEqual(['steps-to-main-content']);
    });

    it('skips analysis when no arrow strategy ran', async () => {
        const result = await rule.run(mockContext([]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.totalSteps).toBe(0);
    });
});
