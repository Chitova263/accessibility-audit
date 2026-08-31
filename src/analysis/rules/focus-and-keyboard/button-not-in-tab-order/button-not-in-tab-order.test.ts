import { describe, it, expect } from 'vitest';
import { rule } from './button-not-in-tab-order';
import { createSteps, strategyResult, mockContext } from '../../test-fixtures';
import type { StepOverrides } from '../../test-fixtures';

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

describe('button-not-in-tab-order rule', () => {
    it('has correct metadata', () => {
        expect(rule.id).toBe('button-not-in-tab-order');
        expect(rule.meta.impact).toBe('serious');
        expect(rule.meta.wcag.primary.criterion).toBe('2.1.1');
    });

    it('reports a button reachable with B but absent from tab order', async () => {
        const result = await rule.run(
            mockContext([
                strategyResult('button', createSteps([button('Submit')])),
                strategyResult('tab', createSteps([link('Home')])),
            ])
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.rule.id).toBe('button-not-in-tab-order');
        expect(result.violations[0]!.message).toContain('reachable via B key navigation');
        expect(result.stats).toMatchObject({
            buttonsInBrowseMode: 1,
            violationsFound: 1,
        });
    });

    it('stays silent when button appears in tab order', async () => {
        const result = await rule.run(
            mockContext([
                strategyResult('button', createSteps([button('Submit')])),
                strategyResult('tab', createSteps([button('Submit')])),
            ])
        );

        expect(result.violations).toHaveLength(0);
    });

    it('matches loosely when tab announcement carries extra text', async () => {
        const tabStep: StepOverrides = { role: 'button', name: 'Submit form', itemText: 'Submit form' };

        const result = await rule.run(
            mockContext([
                strategyResult('button', createSteps([button('Submit')])),
                strategyResult('tab', createSteps([tabStep])),
            ])
        );

        expect(result.violations).toHaveLength(0);
    });

    it('reports an unnamed button which cannot be matched loosely', async () => {
        const result = await rule.run(
            mockContext([
                strategyResult('button', createSteps([{ ...button('x'), name: '' }])),
                strategyResult('tab', createSteps([link('Home')])),
            ])
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.message).toContain('"(unnamed)"');
    });

    it('only collects buttons from button strategy', async () => {
        const result = await rule.run(
            mockContext([strategyResult('button', createSteps([link('Not a button')])), strategyResult('tab', [])])
        );

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.buttonsInBrowseMode).toBe(0);
    });
});
