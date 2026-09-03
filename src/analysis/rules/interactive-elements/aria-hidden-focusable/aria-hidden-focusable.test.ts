import { describe, it, expect } from 'vitest';
import { rule } from './aria-hidden-focusable';
import { createSteps, strategyResult, mockContext } from '../../test-fixtures';

describe('aria-hidden-focusable rule', () => {
    it('reports a focusable element hidden from the accessibility tree', async () => {
        const steps = createSteps([
            {
                focusedElementText: '',
                spokenPhrases: [],
                htmlSnippet: '<a href="/promo" aria-hidden="true">Promo</a>',
            },
        ]);

        const result = await rule.run(mockContext([strategyResult('tab', steps)]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.rule.id).toBe('aria-hidden-focusable');
        expect(result.violations[0]!.message).toContain('(nothing announced)');
    });

    it('quotes what NVDA did announce', async () => {
        const steps = createSteps([
            { spokenPhrases: ['link', 'Promo'], htmlSnippet: '<a aria-hidden="true">Promo</a>' },
        ]);

        const result = await rule.run(mockContext([strategyResult('tab', steps)]));

        expect(result.violations[0]!.message).toContain('NVDA announced: "link, Promo"');
    });

    it.each([
        `<span aria-hidden='true' tabindex="0">x</span>`,
        `<span aria-hidden = "true" tabindex="0">x</span>`,
        `<span ARIA-HIDDEN="TRUE" tabindex="0">x</span>`,
    ])('recognises the attribute written as %s', async (htmlSnippet) => {
        const result = await rule.run(mockContext([strategyResult('tab', createSteps([{ htmlSnippet }]))]));

        expect(result.violations).toHaveLength(1);
    });

    it('leaves aria-hidden="false" alone', async () => {
        const steps = createSteps([{ htmlSnippet: '<a href="/a" aria-hidden="false">Plans</a>' }]);

        const result = await rule.run(mockContext([strategyResult('tab', steps)]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.totalFocusableElements).toBe(1);
    });

    it('only looks at elements that actually received focus', async () => {
        const steps = createSteps([{ htmlSnippet: '<a href="/promo" aria-hidden="true">Promo</a>' }]);

        const result = await rule.run(mockContext([strategyResult('arrow', steps), strategyResult('link', steps)]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.totalFocusableElements).toBe(0);
    });

    it('skips steps with no HTML snippet', async () => {
        const result = await rule.run(mockContext([strategyResult('tab', createSteps([{}, {}]))]));

        expect(result.stats!.totalFocusableElements).toBe(0);
    });

    it('reports an identical snippet once but still counts both focus stops', async () => {
        const htmlSnippet = '<a href="/promo" aria-hidden="true">Promo</a>';
        const steps = createSteps([{ htmlSnippet }, { htmlSnippet }]);

        const result = await rule.run(mockContext([strategyResult('tab', steps)]));

        expect(result.stats).toEqual({ totalFocusableElements: 2, ariaHiddenFocusableCount: 1 });
    });
});
