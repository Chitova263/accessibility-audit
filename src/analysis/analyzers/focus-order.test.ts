import { describe, it, expect } from 'vitest';
import type { TranscriptContext } from '../context';
import { analyzeFocusOrder } from './focus-order';
import type {
    StrategyResult,
    NavigationStep,
} from '../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

const createStep = (
    index: number,
    overrides: Partial<{ itemText: string; role: string; backendDOMNodeId: number; htmlSnippet: string }> = {}
): NavigationStep => {
    const itemText = overrides.itemText ?? `Item ${index}`;

    return {
        index,
        identifier: `step-${index}`,
        spokenPhrases: [itemText],
        itemText,
        itemTextLog: [],
        timestamp: 1_700_000_000_000 + index,
        axNode: {
            nodeId: `${index}`,
            role: { value: overrides.role ?? 'link' },
            name: { value: itemText },
            backendDOMNodeId: overrides.backendDOMNodeId,
        } as never,
        htmlSnippet: overrides.htmlSnippet ?? null,
    };
};

const strategies = (tabSteps: NavigationStep[], arrowSteps?: NavigationStep[]): TranscriptContext => {
    const results: StrategyResult[] = [
        {
            meta: { name: 'tab', description: 'Tab order', type: 'tab', mode: 'focus' },
            navigationSteps: tabSteps,
            completionReason: { kind: 'cycle-complete', detail: 'tab focus cycled through all elements' },
        },
    ];

    if (arrowSteps) {
        results.push({
            meta: { name: 'ArrowNavigation', description: 'Linear reading', type: 'arrow', mode: 'browse' },
            navigationSteps: arrowSteps,
            completionReason: { kind: 'exhausted', detail: 'reached end of document' },
        });
    }

    return { strategyResults: results };
};

/** Reading order: every tenth position is an element, the rest is plain text */
const readingWalk = (): NavigationStep[] =>
    [...Array(60)].map((_, i) =>
        createStep(i, i % 10 === 0 ? { role: 'StaticText', backendDOMNodeId: i } : { role: 'StaticText' })
    );

describe('analyzeFocusOrder reading order comparison', () => {
    it('stays silent when tab order follows reading order', () => {
        const tabSteps = [
            createStep(0, { backendDOMNodeId: 0 }),
            createStep(1, { backendDOMNodeId: 10 }),
            createStep(2, { backendDOMNodeId: 20 }),
        ];

        const result = analyzeFocusOrder(strategies(tabSteps, readingWalk()));

        expect(result.summary.elementsWithReadingPosition).toBe(3);
        expect(result.violations).toEqual([]);
    });

    it('does not report large forward jumps, which are normal for tab navigation', () => {
        const tabSteps = [createStep(0, { backendDOMNodeId: 0 }), createStep(1, { backendDOMNodeId: 50 })];

        const result = analyzeFocusOrder(strategies(tabSteps, readingWalk()));

        expect(result.violations).toEqual([]);
    });

    it('reports focus jumping backwards through the reading order', () => {
        const tabSteps = [createStep(0, { backendDOMNodeId: 40 }), createStep(1, { backendDOMNodeId: 10 })];

        const result = analyzeFocusOrder(strategies(tabSteps, readingWalk()));

        expect(result.violations.map((v) => v.ruleId)).toEqual(['focus-order-anomaly']);
        expect(result.violations[0]?.message).toContain('30 positions earlier');
    });

    it('tolerates small backwards movement from imprecise reading-order matching', () => {
        const arrowSteps = [
            createStep(0, { backendDOMNodeId: 1 }),
            createStep(1, { backendDOMNodeId: 2 }),
            createStep(2, { backendDOMNodeId: 3 }),
        ];
        const tabSteps = [createStep(0, { backendDOMNodeId: 3 }), createStep(1, { backendDOMNodeId: 1 })];

        const result = analyzeFocusOrder(strategies(tabSteps, arrowSteps));

        expect(result.violations).toEqual([]);
    });

    it('skips reading-order comparison when no arrow strategy ran', () => {
        const tabSteps = [createStep(0, { backendDOMNodeId: 40 }), createStep(1, { backendDOMNodeId: 10 })];

        const result = analyzeFocusOrder(strategies(tabSteps));

        expect(result.summary.elementsWithReadingPosition).toBe(0);
        expect(result.violations).toEqual([]);
    });

    it('still reports positive tabindex without any reading order', () => {
        const tabSteps = [createStep(0, { htmlSnippet: '<a href="/a" tabindex="3">Plans</a>' })];

        const result = analyzeFocusOrder(strategies(tabSteps));

        expect(result.violations.map((v) => v.ruleId)).toEqual(['positive-tabindex']);
    });
});
