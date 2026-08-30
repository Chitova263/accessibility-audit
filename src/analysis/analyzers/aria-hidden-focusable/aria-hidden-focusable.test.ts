import { describe, it, expect } from 'vitest';
import { analyzeAriaHiddenFocusable } from './aria-hidden-focusable';
import { createSteps, strategyResult, mockContext } from '../test-fixtures';

describe('analyzeAriaHiddenFocusable', () => {
    it('reports a focusable element hidden from the accessibility tree', async () => {
        const steps = createSteps([
            {
                itemText: '',
                spokenPhrases: [],
                htmlSnippet: '<a href="/promo" aria-hidden="true">Promo</a>',
            },
        ]);

        const result = await analyzeAriaHiddenFocusable(mockContext([strategyResult('tab', steps)]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toMatchObject({
            rule: {
                id: 'aria-hidden-focusable',
                impact: 'critical',
                wcag: { primary: { criterion: '4.1.2', level: 'A' } },
            },
        });
        expect(result.violations[0]?.message).toContain('(nothing announced)');
    });

    it('quotes what NVDA did announce', async () => {
        const steps = createSteps([
            { spokenPhrases: ['link', 'Promo'], htmlSnippet: '<a aria-hidden="true">Promo</a>' },
        ]);

        const result = await analyzeAriaHiddenFocusable(mockContext([strategyResult('tab', steps)]));

        expect(result.violations[0]?.message).toContain('NVDA announced: "link, Promo"');
    });

    it.each([
        `<span aria-hidden='true' tabindex="0">x</span>`,
        `<span aria-hidden = "true" tabindex="0">x</span>`,
        `<span ARIA-HIDDEN="TRUE" tabindex="0">x</span>`,
    ])('recognises the attribute written as %s', async (htmlSnippet) => {
        const result = await analyzeAriaHiddenFocusable(
            mockContext([strategyResult('tab', createSteps([{ htmlSnippet }]))])
        );

        expect(result.violations).toHaveLength(1);
    });

    it('leaves aria-hidden="false" alone', async () => {
        const steps = createSteps([{ htmlSnippet: '<a href="/a" aria-hidden="false">Plans</a>' }]);

        const result = await analyzeAriaHiddenFocusable(mockContext([strategyResult('tab', steps)]));

        expect(result.violations).toEqual([]);
        expect(result.summary.totalFocusableElements).toBe(1);
    });

    it('only looks at elements that actually received focus', async () => {
        const steps = createSteps([{ htmlSnippet: '<a href="/promo" aria-hidden="true">Promo</a>' }]);

        const result = await analyzeAriaHiddenFocusable(
            mockContext([strategyResult('arrow', steps), strategyResult('link', steps)])
        );

        expect(result.violations).toEqual([]);
        expect(result.summary.totalFocusableElements).toBe(0);
    });

    it('skips steps with no HTML snippet', async () => {
        const result = await analyzeAriaHiddenFocusable(mockContext([strategyResult('tab', createSteps([{}, {}]))]));

        expect(result.summary.totalFocusableElements).toBe(0);
    });

    it('reports an identical snippet once but still counts both focus stops', async () => {
        const htmlSnippet = '<a href="/promo" aria-hidden="true">Promo</a>';
        const steps = createSteps([{ htmlSnippet }, { htmlSnippet }]);

        const result = await analyzeAriaHiddenFocusable(mockContext([strategyResult('tab', steps)]));

        expect(result.summary).toEqual({ totalFocusableElements: 2, ariaHiddenFocusableCount: 1 });
    });
});
