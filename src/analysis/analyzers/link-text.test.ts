import { describe, it, expect } from 'vitest';
import type { TranscriptContext } from '../context';
import { analyzeLinkText } from './link-text';
import type {
    StrategyResult,
    NavigationStep,
} from '../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

// =============================================================================
// TEST DATA FIXTURES
// =============================================================================

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

const strategies = (linkSteps: NavigationStep[], arrowSteps?: NavigationStep[]): TranscriptContext => {
    const results: StrategyResult[] = [
        {
            meta: { name: 'link', description: 'Links', type: 'link' },
            navigationSteps: linkSteps,
            completionReason: 'end-of-links',
        },
    ];

    if (arrowSteps) {
        results.push({
            meta: { name: 'ArrowNavigation', description: 'Linear reading', type: 'arrow' },
            navigationSteps: arrowSteps,
            completionReason: 'end-of-document',
        });
    }

    return { strategyResults: results };
};

const genericLink = createStep(0, { itemText: 'Read more', role: 'link', href: '/a', backendDOMNodeId: 42 });

// =============================================================================
// TESTS
// =============================================================================

describe('analyzeLinkText generic link text', () => {
    it('reports a generic link at full impact when the arrow walk found no context', () => {
        const arrowSteps = [
            createStep(0, { itemText: 'Home', role: 'link', backendDOMNodeId: 7 }),
            createStep(1, { itemText: 'Read more', role: 'link', backendDOMNodeId: 42 }),
            createStep(2, { itemText: 'Contact', role: 'link', backendDOMNodeId: 8 }),
        ];

        const result = analyzeLinkText(strategies([genericLink], arrowSteps));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toMatchObject({ ruleId: 'generic-link-text', impact: 'serious' });
        expect(result.violations[0]?.message).toContain('no surrounding text');
        expect(result.summary.genericLinksWithSurroundingContext).toBe(0);
    });

    it('downgrades a generic link that sits in surrounding text and quotes that text', () => {
        const arrowSteps = [
            createStep(0, { itemText: 'Fibre broadband for your home' }),
            createStep(1, { itemText: 'Read more', role: 'link', backendDOMNodeId: 42 }),
            createStep(2, { itemText: 'Available in most regions' }),
        ];

        const result = analyzeLinkText(strategies([genericLink], arrowSteps));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toMatchObject({ ruleId: 'generic-link-text', impact: 'moderate' });
        expect(result.violations[0]?.message).toContain('Fibre broadband for your home');
        expect(result.violations[0]?.message).toContain('Available in most regions');
        expect(result.summary.genericLinksWithSurroundingContext).toBe(1);
    });

    it('falls back to full impact when the arrow walk never reached the link', () => {
        const arrowSteps = [createStep(0, { itemText: 'Some other content' })];

        const result = analyzeLinkText(strategies([genericLink], arrowSteps));

        expect(result.violations[0]).toMatchObject({ impact: 'serious' });
    });

    it('falls back to full impact when no arrow strategy ran at all', () => {
        const result = analyzeLinkText(strategies([genericLink]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toMatchObject({ ruleId: 'generic-link-text', impact: 'serious' });
    });

    it('leaves descriptive link text alone', () => {
        const descriptive = createStep(0, { itemText: 'Compare mobile plans', role: 'link', href: '/plans' });

        const result = analyzeLinkText(strategies([descriptive]));

        expect(result.violations).toEqual([]);
    });
});
