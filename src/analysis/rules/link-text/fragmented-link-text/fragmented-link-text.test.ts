import { describe, it, expect } from 'vitest';
import { FragmentedLinkTextRule } from './fragmented-link-text';
import { mockContext } from '../../test-fixtures';
import type { NavigationStep } from '../../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

const rule = new FragmentedLinkTextRule();

const createStep = (index: number, itemText: string): NavigationStep => ({
    index,
    identifier: `step-${index}`,
    spokenPhrases: [itemText],
    itemText,
    itemTextLog: [],
    timestamp: 1_700_000_000_000 + index,
    axNode: undefined,
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

describe('fragmented-link-text rule', () => {
    it('has correct metadata', () => {
        expect(rule.id).toBe('fragmented-link-text');
        expect(rule.meta.impact).toBe('critical');
        expect(rule.meta.wcag.primary.criterion).toBe('2.4.4');
    });

    it('detects single-character link sequences', async () => {
        const steps = [
            createStep(0, 'Some content'),
            createStep(1, 'link, 2'),
            createStep(2, 'link, 2'),
            createStep(3, 'link, .'),
            createStep(4, 'link, 1'),
            createStep(5, 'link, 5'),
            createStep(6, 'More content'),
        ];

        const result = await rule.run(arrowResult(steps));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.message).toContain('22.15');
        expect(result.stats!.sequences[0]!.reconstructedText).toBe('22.15');
    });

    it('detects "francs" spelled out as character links', async () => {
        const steps = [
            createStep(0, 'link, f'),
            createStep(1, 'link, r'),
            createStep(2, 'link, a'),
            createStep(3, 'link, n'),
            createStep(4, 'link, c'),
            createStep(5, 'link, s'),
        ];

        const result = await rule.run(arrowResult(steps));

        expect(result.violations).toHaveLength(1);
        expect(result.stats!.sequences[0]!.reconstructedText).toBe('francs');
    });

    it('tolerates short sequences below threshold', async () => {
        const steps = [createStep(0, 'link, a'), createStep(1, 'link, b'), createStep(2, 'Normal link text, link')];

        const result = await rule.run(arrowResult(steps));

        expect(result.violations).toHaveLength(0);
    });

    it('honours custom threshold', async () => {
        const steps = [createStep(0, 'link, a'), createStep(1, 'link, b')];
        const customRule = new FragmentedLinkTextRule({ threshold: 2 });

        const result = await customRule.run(arrowResult(steps));

        expect(result.violations).toHaveLength(1);
    });

    it('detects multiple separate fragmented sequences', async () => {
        const steps = [
            createStep(0, 'link, 1'),
            createStep(1, 'link, 2'),
            createStep(2, 'link, 3'),
            createStep(3, 'Normal content'),
            createStep(4, 'link, a'),
            createStep(5, 'link, b'),
            createStep(6, 'link, c'),
        ];

        const result = await rule.run(arrowResult(steps));

        expect(result.violations).toHaveLength(2);
        expect(result.stats!.sequences[0]!.reconstructedText).toBe('123');
        expect(result.stats!.sequences[1]!.reconstructedText).toBe('abc');
    });

    it('ignores normal link text', async () => {
        const steps = [
            createStep(0, 'link, Read more about our services'),
            createStep(1, 'link, Contact us'),
            createStep(2, 'link, Home'),
        ];

        const result = await rule.run(arrowResult(steps));

        expect(result.violations).toHaveLength(0);
    });

    it('skips analysis when no arrow strategy ran', async () => {
        const result = await rule.run(mockContext([]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.sequences).toEqual([]);
    });
});
