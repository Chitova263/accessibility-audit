import { describe, it, expect } from 'vitest';
import { rule } from './focus-order-anomaly';
import { mockContext } from '../../test-fixtures';
import type {
    StrategyResult,
    NavigationStep,
} from '../../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

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

const strategies = (tabSteps: NavigationStep[], arrowSteps?: NavigationStep[]) => {
    const results: StrategyResult[] = [
        {
            meta: { name: 'tab', description: 'Tab order', mode: 'focus' },
            navigationSteps: tabSteps,
            completionReason: { kind: 'cycle-complete', detail: 'tab focus cycled through all elements' },
        },
    ];

    if (arrowSteps) {
        results.push({
            meta: { name: 'arrow', description: 'Linear reading', mode: 'browse' },
            navigationSteps: arrowSteps,
            completionReason: { kind: 'exhausted', detail: 'reached end of document' },
        });
    }

    return mockContext(results);
};

/** Reading order: every tenth position is an element, the rest is plain text */
const readingWalk = (): NavigationStep[] =>
    [...Array(60)].map((_, i) =>
        createStep(i, i % 10 === 0 ? { role: 'StaticText', backendDOMNodeId: i } : { role: 'StaticText' })
    );

describe('focus-order-anomaly rule', () => {
    it('has correct metadata', () => {
        expect(rule.id).toBe('focus-order-anomaly');
        expect(rule.meta.impact).toBe('serious');
        expect(rule.meta.wcag.primary.criterion).toBe('2.4.3');
    });

    it('stays silent when tab order follows reading order', async () => {
        const tabSteps = [
            createStep(0, { backendDOMNodeId: 0 }),
            createStep(1, { backendDOMNodeId: 10 }),
            createStep(2, { backendDOMNodeId: 20 }),
        ];

        const result = await rule.run(strategies(tabSteps, readingWalk()));

        expect(result.stats!.elementsWithReadingPosition).toBe(3);
        expect(result.violations).toHaveLength(0);
    });

    it('does not report large forward jumps, which are normal for tab navigation', async () => {
        const tabSteps = [createStep(0, { backendDOMNodeId: 0 }), createStep(1, { backendDOMNodeId: 50 })];

        const result = await rule.run(strategies(tabSteps, readingWalk()));

        expect(result.violations).toHaveLength(0);
    });

    it('reports focus jumping backwards through the reading order', async () => {
        const tabSteps = [createStep(0, { backendDOMNodeId: 40 }), createStep(1, { backendDOMNodeId: 10 })];

        const result = await rule.run(strategies(tabSteps, readingWalk()));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.rule.id).toBe('focus-order-anomaly');
        expect(result.violations[0]!.message).toContain('30 positions earlier');
    });

    it('tolerates small backwards movement from imprecise reading-order matching', async () => {
        const arrowSteps = [
            createStep(0, { backendDOMNodeId: 1 }),
            createStep(1, { backendDOMNodeId: 2 }),
            createStep(2, { backendDOMNodeId: 3 }),
        ];
        const tabSteps = [createStep(0, { backendDOMNodeId: 3 }), createStep(1, { backendDOMNodeId: 1 })];

        const result = await rule.run(strategies(tabSteps, arrowSteps));

        expect(result.violations).toHaveLength(0);
    });

    it('skips reading-order comparison when no arrow strategy ran', async () => {
        const tabSteps = [createStep(0, { backendDOMNodeId: 40 }), createStep(1, { backendDOMNodeId: 10 })];

        const result = await rule.run(strategies(tabSteps));

        expect(result.stats!.elementsWithReadingPosition).toBe(0);
        expect(result.violations).toHaveLength(0);
    });
});
