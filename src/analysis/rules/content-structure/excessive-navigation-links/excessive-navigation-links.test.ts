import { describe, it, expect } from 'vitest';
import { rule } from './excessive-navigation-links';
import { createStep, createSteps, strategyResult, mockContext } from '../../test-fixtures';
import type { NavigationStep } from '../../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

const links = (count: number): NavigationStep[] =>
    [...Array(count)].map((_, i) => createStep(i, { role: 'link', itemText: `Link ${i}` }));

describe('excessive-navigation-links rule', () => {
    it('has correct metadata', () => {
        expect(rule.id).toBe('excessive-navigation-links');
        expect(rule.meta.impact).toBe('moderate');
        expect(rule.meta.wcag.primary.criterion).toBe('2.4.1');
    });

    it('stays silent for a page with a normal number of links', async () => {
        const result = await rule.run(mockContext([strategyResult('link', links(39))]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.totalLinks).toBe(39);
    });

    it('reports a page at the excessive threshold', async () => {
        const result = await rule.run(mockContext([strategyResult('link', links(40))]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.rule.id).toBe('excessive-navigation-links');
        expect(result.violations[0]!.message).toContain('40 links (threshold: 40)');
    });

    it('raises the severity once the page is well past the threshold', async () => {
        const result = await rule.run(mockContext([strategyResult('link', links(75))]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.rule.impact).toBe('serious');
        expect(result.violations[0]!.message).toContain('75 links (threshold: 75)');
    });

    it('anchors the violation on the first link', async () => {
        const result = await rule.run(mockContext([strategyResult('link', links(50))]));

        expect(result.violations[0]!.id).toBe('excessive-navigation-step-0');
        expect(result.violations[0]!.context).toMatchObject({ source: { strategy: 'link', stepIndex: 0 } });
    });

    it('spreads the link count evenly across navigation landmarks', async () => {
        const landmarks = createSteps([
            { role: 'navigation', name: 'Primary' },
            { role: 'navigation', name: '' },
            { role: 'main', name: 'Main content' },
        ]);

        const result = await rule.run(
            mockContext([strategyResult('link', links(50)), strategyResult('landmark', landmarks)])
        );

        expect(result.stats!.navigationLandmarks).toBe(2);
        expect(result.stats!.linksPerNavigation).toEqual({ Primary: 25, '(unnamed navigation)': 25 });
    });

    it('reports no links when the link strategy never ran', async () => {
        const result = await rule.run(mockContext([strategyResult('tab', links(100))]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats).toEqual({ totalLinks: 0, navigationLandmarks: 0, linksPerNavigation: {} });
    });
});


