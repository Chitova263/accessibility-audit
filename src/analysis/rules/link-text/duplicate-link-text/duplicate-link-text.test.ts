import { describe, it, expect } from 'vitest';
import { rule } from './duplicate-link-text';
import { mockContext } from '../../test-fixtures';
import type {
    StrategyResult,
    NavigationStep,
} from '../../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

const createStep = (
    index: number,
    overrides: Partial<{
        focusedElementText: string;
        role: string;
        name: string;
        href: string;
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
        htmlSnippet: overrides.href ? `<a href="${overrides.href}">${focusedElementText}</a>` : null,
    };
};

const linkStrategy = (linkSteps: NavigationStep[]) => {
    const results: StrategyResult[] = [
        {
            meta: { name: 'link', description: 'Links', mode: 'browse' },
            navigationSteps: linkSteps,
            completionReason: { kind: 'exhausted', detail: 'no more links found' },
        },
    ];
    return mockContext(results);
};

describe('duplicate-link-text rule', () => {
    it('has correct metadata', () => {
        expect(rule.id).toBe('duplicate-link-text');
        expect(rule.meta.impact).toBe('moderate');
        expect(rule.meta.wcag.primary.criterion).toBe('2.4.4');
    });

    it('reports links with same text but different destinations', async () => {
        const links = [
            createStep(0, { focusedElementText: 'Read more', role: 'link', href: '/article-1' }),
            createStep(1, { focusedElementText: 'Read more', role: 'link', href: '/article-2' }),
            createStep(2, { focusedElementText: 'Read more', role: 'link', href: '/article-3' }),
        ];

        const result = await rule.run(linkStrategy(links));

        expect(result.violations).toHaveLength(3);
        expect(result.violations[0]!.rule.id).toBe('duplicate-link-text');
        expect(result.violations[0]!.message).toContain('3 links share the text');
        expect(result.violations[0]!.message).toContain('3 different destinations');
        expect(result.stats).toMatchObject({
            totalLinks: 3,
            violationsFound: 3,
            duplicateGroups: 1,
        });
    });

    it('stays silent when same text goes to same destination', async () => {
        const links = [
            createStep(0, { focusedElementText: 'Home', role: 'link', href: '/' }),
            createStep(1, { focusedElementText: 'Home', role: 'link', href: '/' }),
        ];

        const result = await rule.run(linkStrategy(links));

        expect(result.violations).toHaveLength(0);
    });

    it('stays silent when links have unique text', async () => {
        const links = [
            createStep(0, { focusedElementText: 'Article One', role: 'link', href: '/article-1' }),
            createStep(1, { focusedElementText: 'Article Two', role: 'link', href: '/article-2' }),
        ];

        const result = await rule.run(linkStrategy(links));

        expect(result.violations).toHaveLength(0);
    });

    it('matches link text case-insensitively', async () => {
        const links = [
            createStep(0, { focusedElementText: 'Read More', role: 'link', href: '/a' }),
            createStep(1, { focusedElementText: 'read more', role: 'link', href: '/b' }),
        ];

        const result = await rule.run(linkStrategy(links));

        expect(result.violations).toHaveLength(2);
    });

    it('counts multiple duplicate groups separately', async () => {
        const links = [
            createStep(0, { focusedElementText: 'Details', role: 'link', href: '/a' }),
            createStep(1, { focusedElementText: 'Details', role: 'link', href: '/b' }),
            createStep(2, { focusedElementText: 'Learn more', role: 'link', href: '/x' }),
            createStep(3, { focusedElementText: 'Learn more', role: 'link', href: '/y' }),
        ];

        const result = await rule.run(linkStrategy(links));

        expect(result.violations).toHaveLength(4);
        expect(result.stats!.duplicateGroups).toBe(2);
    });
});
