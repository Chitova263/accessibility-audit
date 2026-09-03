import { describe, it, expect } from 'vitest';
import { NestedInteractiveElementsRule } from './nested-interactive-elements';
import { mockContext } from '../../test-fixtures';
import type { NavigationStep } from '../../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

const rule = new NestedInteractiveElementsRule();

const createStep = (index: number, focusedElementText: string): NavigationStep => ({
    index,
    identifier: `step-${index}`,
    spokenPhrases: [focusedElementText],
    focusedElementText,
    focusedElementTextLog: [],
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

describe('nested-interactive-elements rule', () => {
    it('detects "link, link" pattern', async () => {
        const steps = [
            createStep(0, 'Some content'),
            createStep(1, 'To the offer, link, link'),
            createStep(2, 'More content'),
        ];

        const result = await rule.run(arrowResult(steps));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.message).toContain('link, link');
    });

    it('detects "button, link" pattern', async () => {
        const steps = [createStep(0, 'Submit, button, link')];

        const result = await rule.run(arrowResult(steps));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.message).toContain('button, link');
    });

    it('detects "link, button" pattern', async () => {
        const steps = [createStep(0, 'Click here, link, button')];

        const result = await rule.run(arrowResult(steps));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.message).toContain('link, button');
    });

    it('does not flag normal links', async () => {
        const steps = [
            createStep(0, 'link, Read more'),
            createStep(1, 'link, Contact us'),
            createStep(2, 'button, Submit'),
        ];

        const result = await rule.run(arrowResult(steps));

        expect(result.violations).toHaveLength(0);
    });

    it('deduplicates identical patterns', async () => {
        const steps = [
            createStep(0, 'To the offer, link, link'),
            createStep(1, 'To the offer, link, link'),
            createStep(2, 'To the offer, link, link'),
        ];

        const result = await rule.run(arrowResult(steps));

        expect(result.violations).toHaveLength(1);
    });

    it('reports different nested patterns separately', async () => {
        const steps = [createStep(0, 'Offer A, link, link'), createStep(1, 'Offer B, link, link')];

        const result = await rule.run(arrowResult(steps));

        expect(result.violations).toHaveLength(2);
    });

    it('skips analysis when no relevant strategy ran', async () => {
        const result = await rule.run(mockContext([]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.patterns).toEqual([]);
    });
});
