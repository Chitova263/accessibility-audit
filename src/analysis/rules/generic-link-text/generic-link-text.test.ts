import { describe, it, expect } from 'vitest';
import { rule } from './generic-link-text';
import { mockContext } from '../test-fixtures';
import type {
    StrategyResult,
    NavigationStep,
} from '../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

const createStep = (
    index: number,
    overrides: Partial<{ itemText: string; role: string; name: string; href: string; backendDOMNodeId: number }> = {}
): NavigationStep => {
    const itemText = overrides.itemText ?? `Item ${index}`;
    const role = overrides.role;

    return {
        index,
        identifier: `step-${index}`,
        spokenPhrases: [itemText],
        itemText,
        itemTextLog: [],
        timestamp: 1_700_000_000_000 + index,
        axNode: role
            ? ({
                  nodeId: `${index}`,
                  role: { value: role },
                  name: { value: overrides.name ?? itemText },
                  backendDOMNodeId: overrides.backendDOMNodeId,
              } as never)
            : undefined,
        htmlSnippet: overrides.href ? `<a href="${overrides.href}">${itemText}</a>` : null,
    };
};

const strategies = (linkSteps: NavigationStep[], arrowSteps?: NavigationStep[]) => {
    const results: StrategyResult[] = [
        {
            meta: { name: 'link', description: 'Links', type: 'link', mode: 'browse' },
            navigationSteps: linkSteps,
            completionReason: { kind: 'exhausted', detail: 'no more links found' },
        },
    ];

    if (arrowSteps) {
        results.push({
            meta: { name: 'ArrowNavigation', description: 'Linear reading', type: 'arrow', mode: 'browse' },
            navigationSteps: arrowSteps,
            completionReason: { kind: 'exhausted', detail: 'reached end of document' },
        });
    }

    return mockContext(results);
};

const genericLink = createStep(0, { itemText: 'Read more', role: 'link', href: '/a', backendDOMNodeId: 42 });

describe('generic-link-text rule', () => {
    it('has correct metadata', () => {
        expect(rule.id).toBe('generic-link-text');
        expect(rule.meta.impact).toBe('serious');
        expect(rule.meta.wcag.primary.criterion).toBe('2.4.4');
    });

    it('reports a generic link at full impact when no surrounding context', async () => {
        const arrowSteps = [
            createStep(0, { itemText: 'Home', role: 'link', backendDOMNodeId: 7 }),
            createStep(1, { itemText: 'Read more', role: 'link', backendDOMNodeId: 42 }),
            createStep(2, { itemText: 'Contact', role: 'link', backendDOMNodeId: 8 }),
        ];

        const result = await rule.run(strategies([genericLink], arrowSteps));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.rule.id).toBe('generic-link-text');
        expect(result.violations[0]!.rule.impact).toBe('serious');
        expect(result.violations[0]!.message).toContain('no surrounding text');
        expect(result.stats!.genericLinksWithSurroundingContext).toBe(0);
    });

    it('downgrades impact when surrounding text provides context', async () => {
        const arrowSteps = [
            createStep(0, { itemText: 'Fibre broadband for your home' }),
            createStep(1, { itemText: 'Read more', role: 'link', backendDOMNodeId: 42 }),
            createStep(2, { itemText: 'Available in most regions' }),
        ];

        const result = await rule.run(strategies([genericLink], arrowSteps));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.rule.impact).toBe('moderate');
        expect(result.violations[0]!.message).toContain('Fibre broadband for your home');
        expect(result.violations[0]!.message).toContain('Available in most regions');
        expect(result.stats!.genericLinksWithSurroundingContext).toBe(1);
    });

    it('falls back to full impact when arrow walk never reached the link', async () => {
        const arrowSteps = [createStep(0, { itemText: 'Some other content' })];

        const result = await rule.run(strategies([genericLink], arrowSteps));

        expect(result.violations[0]!.rule.impact).toBe('serious');
    });

    it('falls back to full impact when no arrow strategy ran', async () => {
        const result = await rule.run(strategies([genericLink]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.rule.impact).toBe('serious');
    });

    it('leaves descriptive link text alone', async () => {
        const descriptive = createStep(0, { itemText: 'Compare mobile plans', role: 'link', href: '/plans' });

        const result = await rule.run(strategies([descriptive]));

        expect(result.violations).toHaveLength(0);
    });
});
