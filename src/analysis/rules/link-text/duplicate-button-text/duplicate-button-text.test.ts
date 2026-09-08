import { describe, it, expect } from 'vitest';
import { rule } from './duplicate-button-text';
import { mockContext } from '../../test-fixtures';
import type { StrategyResult, NavigationStep } from '../../../../screen-reader/strategies/navigation-strategy';

const createStep = (
    index: number,
    overrides: Partial<{
        focusedElementText: string;
        role: string;
        name: string;
        backendDOMNodeId: number;
    }> = {}
): NavigationStep => {
    const focusedElementText = overrides.focusedElementText ?? `Item ${index}`;
    const role = overrides.role;

    return {
        index,
        identifier: `step-${index}`,
        spokenPhrases: [focusedElementText],
        focusedElementText,
        focusedElementTextLog: [],
        timestamp: 1_700_000_000_000 + index,
        axNode: role
            ? ({
                  nodeId: `${index}`,
                  role: { value: role },
                  name: { value: overrides.name ?? focusedElementText },
                  backendDOMNodeId: overrides.backendDOMNodeId,
              } as never)
            : undefined,
        htmlSnippet: `<button>${focusedElementText}</button>`,
    };
};

const buttonStrategy = (buttonSteps: NavigationStep[]) => {
    const results: StrategyResult[] = [
        {
            meta: { name: 'button', description: 'Buttons' },
            navigationSteps: buttonSteps,
            completionReason: { kind: 'exhausted', detail: 'no more buttons found' },
        },
    ];
    return mockContext(results);
};

describe('duplicate-button-text rule', () => {
    it('reports buttons with same text', async () => {
        const buttons = [
            createStep(0, { focusedElementText: 'Add to cart', role: 'button', name: 'Add to cart' }),
            createStep(1, { focusedElementText: 'Add to cart', role: 'button', name: 'Add to cart' }),
            createStep(2, { focusedElementText: 'Add to cart', role: 'button', name: 'Add to cart' }),
        ];

        const result = await rule.run(buttonStrategy(buttons));

        expect(result.violations).toHaveLength(3);
        expect(result.violations[0]!.rule.id).toBe('duplicate-button-text');
        expect(result.violations[0]!.message).toContain('3 buttons share the text');
        expect(result.violations[0]!.message).toContain('Add to cart');
        expect(result.stats).toMatchObject({
            totalButtons: 3,
            violationsFound: 3,
            duplicateGroups: 1,
        });
    });

    it('stays silent when buttons have unique text', async () => {
        const buttons = [
            createStep(0, { focusedElementText: 'Add Product A', role: 'button', name: 'Add Product A' }),
            createStep(1, { focusedElementText: 'Add Product B', role: 'button', name: 'Add Product B' }),
        ];

        const result = await rule.run(buttonStrategy(buttons));

        expect(result.violations).toHaveLength(0);
    });

    it('stays silent when there is only one button', async () => {
        const buttons = [createStep(0, { focusedElementText: 'Submit', role: 'button', name: 'Submit' })];

        const result = await rule.run(buttonStrategy(buttons));

        expect(result.violations).toHaveLength(0);
    });

    it('matches button text case-insensitively', async () => {
        const buttons = [
            createStep(0, { focusedElementText: 'Choose Subscription', role: 'button', name: 'Choose Subscription' }),
            createStep(1, { focusedElementText: 'choose subscription', role: 'button', name: 'choose subscription' }),
        ];

        const result = await rule.run(buttonStrategy(buttons));

        expect(result.violations).toHaveLength(2);
    });

    it('counts multiple duplicate groups separately', async () => {
        const buttons = [
            createStep(0, { focusedElementText: 'Add to cart', role: 'button', name: 'Add to cart' }),
            createStep(1, { focusedElementText: 'Add to cart', role: 'button', name: 'Add to cart' }),
            createStep(2, { focusedElementText: 'Show details', role: 'button', name: 'Show details' }),
            createStep(3, { focusedElementText: 'Show details', role: 'button', name: 'Show details' }),
        ];

        const result = await rule.run(buttonStrategy(buttons));

        expect(result.violations).toHaveLength(4);
        expect(result.stats!.duplicateGroups).toBe(2);
    });

    it('ignores buttons with empty names (handled by empty-accessible-name)', async () => {
        const buttons = [
            createStep(0, { focusedElementText: '', role: 'button', name: '' }),
            createStep(1, { focusedElementText: '', role: 'button', name: '' }),
        ];

        const result = await rule.run(buttonStrategy(buttons));

        expect(result.violations).toHaveLength(0);
    });

    it('trims whitespace when comparing button names', async () => {
        const buttons = [
            createStep(0, { focusedElementText: 'Submit', role: 'button', name: 'Submit' }),
            createStep(1, { focusedElementText: 'Submit', role: 'button', name: '  Submit  ' }),
        ];

        const result = await rule.run(buttonStrategy(buttons));

        expect(result.violations).toHaveLength(2);
    });

    it('only processes button strategy results', async () => {
        const results: StrategyResult[] = [
            {
                meta: { name: 'link', description: 'Links' },
                navigationSteps: [
                    createStep(0, { focusedElementText: 'Click', role: 'button', name: 'Click' }),
                    createStep(1, { focusedElementText: 'Click', role: 'button', name: 'Click' }),
                ],
                completionReason: { kind: 'exhausted', detail: 'done' },
            },
        ];

        const result = await rule.run(mockContext(results));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.totalButtons).toBe(0);
    });

    it('only counts elements with button role', async () => {
        const buttons = [
            createStep(0, { focusedElementText: 'Submit', role: 'button', name: 'Submit' }),
            createStep(1, { focusedElementText: 'Submit', role: 'link', name: 'Submit' }),
        ];

        const result = await rule.run(buttonStrategy(buttons));

        // Only one button role element, so no duplicates
        expect(result.violations).toHaveLength(0);
        expect(result.stats!.totalButtons).toBe(1);
    });
});
