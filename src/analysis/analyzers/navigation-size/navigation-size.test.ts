import { describe, it, expect } from 'vitest';
import { analyzeNavigationSize } from './navigation-size';
import { createStep, createSteps, strategyResult, mockContext } from '../test-fixtures';
import type { NavigationStep } from '../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

const links = (count: number): NavigationStep[] =>
    [...Array(count)].map((_, i) => createStep(i, { role: 'link', itemText: `Link ${i}` }));

describe('analyzeNavigationSize', () => {
    it('stays silent for a page with a normal number of links', async () => {
        const result = await analyzeNavigationSize(mockContext([strategyResult('link', links(39))]));

        expect(result.violations).toEqual([]);
        expect(result.summary.totalLinks).toBe(39);
    });

    it('reports a page at the excessive threshold', async () => {
        const result = await analyzeNavigationSize(mockContext([strategyResult('link', links(40))]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toMatchObject({
            rule: {
                id: 'excessive-navigation-links',
                impact: 'moderate',
                wcag: { primary: { criterion: '2.4.1', level: 'A' } },
            },
        });
        expect(result.violations[0]?.message).toContain('40 links (threshold: 40)');
    });

    it('raises the severity once the page is well past the threshold', async () => {
        const result = await analyzeNavigationSize(mockContext([strategyResult('link', links(75))]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]?.rule.impact).toBe('serious');
        expect(result.violations[0]?.message).toContain('75 links (threshold: 75)');
    });

    it('anchors the violation on the first link', async () => {
        const result = await analyzeNavigationSize(mockContext([strategyResult('link', links(50))]));

        expect(result.violations[0]?.id).toBe('excessive-navigation-step-0');
        expect(result.violations[0]?.context).toMatchObject({ step: { strategy: 'link', index: 0 } });
    });

    it('spreads the link count evenly across navigation landmarks', async () => {
        const landmarks = createSteps([
            { role: 'navigation', name: 'Primary' },
            { role: 'navigation', name: '' },
            { role: 'main', name: 'Main content' },
        ]);

        const result = await analyzeNavigationSize(
            mockContext([strategyResult('link', links(50)), strategyResult('landmark', landmarks)])
        );

        expect(result.summary.navigationLandmarks).toBe(2);
        expect(result.summary.linksPerNavigation).toEqual({ Primary: 25, '(unnamed navigation)': 25 });
    });

    it('reports no links when the link strategy never ran', async () => {
        const result = await analyzeNavigationSize(mockContext([strategyResult('tab', links(100))]));

        expect(result.violations).toEqual([]);
        expect(result.summary).toEqual({ totalLinks: 0, navigationLandmarks: 0, linksPerNavigation: {} });
    });
});
