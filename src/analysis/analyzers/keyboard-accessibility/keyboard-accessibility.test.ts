import { describe, it, expect } from 'vitest';
import { analyzeKeyboardAccessibility } from './keyboard-accessibility';
import { createSteps, strategyResult, mockContext } from '../test-fixtures';
import type { StepOverrides } from '../test-fixtures';

const button = (name: string): StepOverrides => ({
    role: 'button',
    name,
    itemText: name,
    identifier: `button-${name}`,
    htmlSnippet: `<button>${name}</button>`,
});

const link = (name: string): StepOverrides => ({
    role: 'link',
    name,
    itemText: name,
    identifier: `link-${name}`,
    htmlSnippet: `<a href="/x">${name}</a>`,
});

describe('analyzeKeyboardAccessibility', () => {
    it('reports a button reachable with B but absent from the tab order', async () => {
        const result = await analyzeKeyboardAccessibility(
            mockContext([
                strategyResult('button', createSteps([button('Submit')])),
                strategyResult('tab', createSteps([link('Home')])),
            ])
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toMatchObject({
            rule: {
                id: 'button-not-in-tab-order',
                impact: 'serious',
                wcag: { primary: { criterion: '2.1.1', level: 'A' } },
            },
        });
        expect(result.violations[0]?.message).toContain('reachable via B key navigation');
        expect(result.summary.byIssue['button-not-in-tab-order']).toBe(1);
    });

    it('reports a link reachable with K but absent from the tab order', async () => {
        const result = await analyzeKeyboardAccessibility(
            mockContext([
                strategyResult('link', createSteps([link('Compare plans')])),
                strategyResult('tab', createSteps([button('Search')])),
            ])
        );

        expect(result.violations.map((v) => v.rule.id)).toEqual(['link-not-in-tab-order']);
        expect(result.violations[0]?.message).toContain('reachable via K key navigation');
    });

    it('stays silent when the same element appears in the tab order', async () => {
        const result = await analyzeKeyboardAccessibility(
            mockContext([
                strategyResult('button', createSteps([button('Submit')])),
                strategyResult('tab', createSteps([button('Submit')])),
            ])
        );

        expect(result.violations).toEqual([]);
    });

    it('matches loosely when the tab announcement carries extra text', async () => {
        const tabStep: StepOverrides = { role: 'button', name: 'Submit form', itemText: 'Submit form' };

        const result = await analyzeKeyboardAccessibility(
            mockContext([
                strategyResult('button', createSteps([button('Submit')])),
                strategyResult('tab', createSteps([tabStep])),
            ])
        );

        expect(result.violations).toEqual([]);
    });

    it('reports an unnamed button, which cannot be matched loosely', async () => {
        const result = await analyzeKeyboardAccessibility(
            mockContext([
                strategyResult('button', createSteps([{ ...button('x'), name: '' }])),
                strategyResult('tab', createSteps([link('Home')])),
            ])
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]?.message).toContain('"(unnamed)"');
    });

    it('only collects elements whose role matches the strategy that found them', async () => {
        const result = await analyzeKeyboardAccessibility(
            mockContext([
                strategyResult('button', createSteps([link('Not a button')])),
                strategyResult('link', createSteps([button('Not a link')])),
                strategyResult('tab', []),
            ])
        );

        expect(result.violations).toEqual([]);
        expect(result.summary).toMatchObject({ buttonsInBrowseMode: 0, linksInBrowseMode: 0 });
    });

    it('counts elements found in browse mode and in focus mode', async () => {
        const result = await analyzeKeyboardAccessibility(
            mockContext([
                strategyResult('button', createSteps([button('Submit'), button('Cancel')])),
                strategyResult('link', createSteps([link('Home')])),
                strategyResult('tab', createSteps([button('Submit'), button('Cancel'), link('Home')])),
            ])
        );

        expect(result.summary).toMatchObject({
            buttonsInBrowseMode: 2,
            buttonsInFocusMode: 2,
            linksInBrowseMode: 1,
            linksInFocusMode: 1,
            violationsFound: 0,
        });
    });
});
