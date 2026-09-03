import { describe, it, expect } from 'vitest';
import { rule } from './link-not-in-tab-order';
import { createSteps, strategyResult, mockContext } from '../../test-fixtures';
import type { StepOverrides } from '../../test-fixtures';

const button = (name: string): StepOverrides => ({
    role: 'button',
    name,
    focusedElementText: name,
    identifier: `button-${name}`,
    htmlSnippet: `<button>${name}</button>`,
});

const link = (name: string): StepOverrides => ({
    role: 'link',
    name,
    focusedElementText: name,
    identifier: `link-${name}`,
    htmlSnippet: `<a href="/x">${name}</a>`,
});

describe('link-not-in-tab-order rule', () => {
    it('reports a link reachable with K but absent from tab order', async () => {
        const result = await rule.run(
            mockContext([
                strategyResult('link', createSteps([link('Compare plans')])),
                strategyResult('tab', createSteps([button('Search')])),
            ])
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.rule.id).toBe('link-not-in-tab-order');
        expect(result.violations[0]!.message).toContain('reachable via K key navigation');
        expect(result.stats).toMatchObject({
            linksInBrowseMode: 1,
            violationsFound: 1,
        });
    });

    it('stays silent when link appears in tab order', async () => {
        const result = await rule.run(
            mockContext([
                strategyResult('link', createSteps([link('Home')])),
                strategyResult('tab', createSteps([link('Home')])),
            ])
        );

        expect(result.violations).toHaveLength(0);
    });

    it('matches loosely when tab announcement carries extra text', async () => {
        const tabStep: StepOverrides = { role: 'link', name: 'Home page', focusedElementText: 'Home page' };

        const result = await rule.run(
            mockContext([
                strategyResult('link', createSteps([link('Home')])),
                strategyResult('tab', createSteps([tabStep])),
            ])
        );

        expect(result.violations).toHaveLength(0);
    });

    it('only collects links from link strategy', async () => {
        const result = await rule.run(
            mockContext([strategyResult('link', createSteps([button('Not a link')])), strategyResult('tab', [])])
        );

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.linksInBrowseMode).toBe(0);
    });

    it('counts links found in browse and focus mode', async () => {
        const result = await rule.run(
            mockContext([
                strategyResult('link', createSteps([link('Home'), link('About')])),
                strategyResult('tab', createSteps([link('Home'), link('About')])),
            ])
        );

        expect(result.stats).toMatchObject({
            linksInBrowseMode: 2,
            linksInFocusMode: 2,
            violationsFound: 0,
        });
    });
});
