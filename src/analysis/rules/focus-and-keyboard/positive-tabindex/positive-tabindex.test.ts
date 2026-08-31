import { describe, it, expect } from 'vitest';
import { rule } from './positive-tabindex';
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

const tabStrategy = (tabSteps: NavigationStep[]) => {
    const results: StrategyResult[] = [
        {
            meta: { name: 'tab', description: 'Tab order', type: 'tab', mode: 'focus' },
            navigationSteps: tabSteps,
            completionReason: { kind: 'cycle-complete', detail: 'tab focus cycled through all elements' },
        },
    ];
    return mockContext(results);
};

describe('positive-tabindex rule', () => {
    it('has correct metadata', () => {
        expect(rule.id).toBe('positive-tabindex');
        expect(rule.meta.impact).toBe('serious');
        expect(rule.meta.wcag.primary.criterion).toBe('2.4.3');
    });

    it('reports positive tabindex', async () => {
        const tabSteps = [createStep(0, { htmlSnippet: '<a href="/a" tabindex="3">Plans</a>' })];

        const result = await rule.run(tabStrategy(tabSteps));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.rule.id).toBe('positive-tabindex');
        expect(result.violations[0]!.message).toContain('tabindex="3"');
        expect(result.violations[0]!.message).toContain('Positive tabindex values disrupt natural focus order');
    });

    it('ignores tabindex="0"', async () => {
        const tabSteps = [createStep(0, { htmlSnippet: '<div tabindex="0">Custom widget</div>' })];

        const result = await rule.run(tabStrategy(tabSteps));

        expect(result.violations).toHaveLength(0);
    });

    it('ignores tabindex="-1"', async () => {
        const tabSteps = [createStep(0, { htmlSnippet: '<div tabindex="-1">Hidden focus</div>' })];

        const result = await rule.run(tabStrategy(tabSteps));

        expect(result.violations).toHaveLength(0);
    });

    it('ignores elements without tabindex', async () => {
        const tabSteps = [createStep(0, { htmlSnippet: '<a href="/a">Normal link</a>' })];

        const result = await rule.run(tabStrategy(tabSteps));

        expect(result.violations).toHaveLength(0);
    });

    it('reports multiple elements with positive tabindex', async () => {
        const tabSteps = [
            createStep(0, { htmlSnippet: '<a href="/a" tabindex="1">First</a>' }),
            createStep(1, { htmlSnippet: '<a href="/b" tabindex="2">Second</a>' }),
            createStep(2, { htmlSnippet: '<a href="/c">Normal</a>' }),
        ];

        const result = await rule.run(tabStrategy(tabSteps));

        expect(result.violations).toHaveLength(2);
        expect(result.stats!.totalFocusableElements).toBe(3);
    });
});


