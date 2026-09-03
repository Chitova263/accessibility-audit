import { describe, it, expect } from 'vitest';
import { rule } from './focus-trap';
import { createSteps, strategyResult, mockContext } from '../../test-fixtures';
import type { CompletionReason } from '../../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

const trapped: CompletionReason = { kind: 'trapped', detail: 'keyboard focus could not escape' };
const cycleComplete: CompletionReason = { kind: 'cycle-complete', detail: 'tab focus cycled through all elements' };

describe('focus-trap rule', () => {
    it('reports the element the tab walk got stuck on', async () => {
        const steps = createSteps([
            { focusedElementText: 'Home' },
            { focusedElementText: 'Plans' },
            { focusedElementText: 'Close dialog', role: 'button', htmlSnippet: '<button>Close dialog</button>' },
        ]);

        const result = await rule.run(mockContext([strategyResult('tab', steps, trapped)]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.rule.id).toBe('focus-trap');
        expect(result.violations[0]!.element).toMatchObject({ htmlSnippet: '<button>Close dialog</button>' });
        expect(result.violations[0]!.message).toContain('after 3 tab presses');
        expect(result.violations[0]!.message).toContain('"Close dialog"');
        expect(result.stats).toMatchObject({
            tabStrategiesChecked: 1,
            focusTrapsFound: 1,
        });
    });

    it('stays silent when the tab walk completed its cycle', async () => {
        const steps = createSteps([{ focusedElementText: 'Home' }, { focusedElementText: 'Plans' }]);

        const result = await rule.run(mockContext([strategyResult('tab', steps, cycleComplete)]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats).toMatchObject({
            tabStrategiesChecked: 1,
            focusTrapsFound: 0,
        });
    });

    it('ignores trapped completion reported by a browse-mode strategy', async () => {
        const steps = createSteps([{ focusedElementText: 'Home' }]);

        const result = await rule.run(mockContext([strategyResult('arrow', steps, trapped)]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.tabStrategiesChecked).toBe(0);
    });

    it('has nothing to report when the trapped run recorded no steps', async () => {
        const result = await rule.run(mockContext([strategyResult('tab', [], trapped)]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.tabStrategiesChecked).toBe(1);
    });

    it('checks every tab strategy in the run', async () => {
        const steps = createSteps([{ focusedElementText: 'Modal' }]);

        const result = await rule.run(
            mockContext([strategyResult('tab', steps, trapped), strategyResult('tab', steps, cycleComplete)])
        );

        expect(result.stats).toMatchObject({
            tabStrategiesChecked: 2,
            focusTrapsFound: 1,
        });
    });
});
