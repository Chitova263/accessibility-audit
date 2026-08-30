import { describe, it, expect } from 'vitest';
import { analyzeFocusTraps } from './focus-trap';
import { createSteps, strategyResult } from './test-fixtures';
import type { CompletionReason } from '../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

const trapped: CompletionReason = { kind: 'trapped', detail: 'keyboard focus could not escape' };
const cycleComplete: CompletionReason = { kind: 'cycle-complete', detail: 'tab focus cycled through all elements' };

describe('analyzeFocusTraps', () => {
    it('reports the element the tab walk got stuck on', () => {
        const steps = createSteps([
            { itemText: 'Home' },
            { itemText: 'Plans' },
            { itemText: 'Close dialog', role: 'button', htmlSnippet: '<button>Close dialog</button>' },
        ]);

        const result = analyzeFocusTraps({ strategyResults: [strategyResult('tab', steps, trapped)] });

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toMatchObject({
            ruleId: 'focus-trap',
            impact: 'critical',
            wcag: { primary: { criterion: '2.1.2', level: 'A' } },
            element: { htmlSnippet: '<button>Close dialog</button>' },
        });
        expect(result.violations[0]?.message).toContain('after 3 tab presses');
        expect(result.violations[0]?.message).toContain('"Close dialog"');
        expect(result.violations[0]?.toolDetails).toMatchObject({ navigationStrategy: 'tab', stepIndex: 2 });
    });

    it('stays silent when the tab walk completed its cycle', () => {
        const steps = createSteps([{ itemText: 'Home' }, { itemText: 'Plans' }]);

        const result = analyzeFocusTraps({ strategyResults: [strategyResult('tab', steps, cycleComplete)] });

        expect(result.violations).toEqual([]);
        expect(result.summary).toEqual({ tabStrategiesChecked: 1, focusTrapsFound: 0 });
    });

    it('ignores a trapped completion reported by a browse-mode strategy', () => {
        const steps = createSteps([{ itemText: 'Home' }]);

        const result = analyzeFocusTraps({ strategyResults: [strategyResult('arrow', steps, trapped)] });

        expect(result.violations).toEqual([]);
        expect(result.summary.tabStrategiesChecked).toBe(0);
    });

    it('has nothing to report when the trapped run recorded no steps', () => {
        const result = analyzeFocusTraps({ strategyResults: [strategyResult('tab', [], trapped)] });

        expect(result.violations).toEqual([]);
        expect(result.summary.tabStrategiesChecked).toBe(1);
    });

    it('checks every tab strategy in the run', () => {
        const steps = createSteps([{ itemText: 'Modal' }]);

        const result = analyzeFocusTraps({
            strategyResults: [strategyResult('tab', steps, trapped), strategyResult('tab', steps, cycleComplete)],
        });

        expect(result.summary).toEqual({ tabStrategiesChecked: 2, focusTrapsFound: 1 });
    });
});
