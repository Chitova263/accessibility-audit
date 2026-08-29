import { describe, it, expect } from 'vitest';
import { analyzeRoleMismatch } from './role-mismatch';
import { createSteps, strategyResult } from './test-fixtures';

describe('analyzeRoleMismatch', () => {
    it('reports a link marked up as a button', () => {
        const steps = createSteps([
            { role: 'button', name: 'Buy now', htmlSnippet: '<a href="/buy" role="button">Buy now</a>' },
        ]);

        const result = analyzeRoleMismatch({ strategyResults: [strategyResult('button', steps)] });

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toMatchObject({
            ruleId: 'role-mismatch',
            impact: 'moderate',
            wcag: { primary: { criterion: '4.1.2', level: 'A' } },
        });
        expect(result.violations[0]?.message).toContain('Link (<a>) has role="button"');
        expect(result.violations[0]?.message).toContain('and name "Buy now"');
        expect(result.summary.byIssue['link-as-button']).toBe(1);
    });

    it('reports a button marked up as a link', () => {
        const steps = createSteps([{ role: 'link', name: 'Next', htmlSnippet: '<button role="link">Next</button>' }]);

        const result = analyzeRoleMismatch({ strategyResults: [strategyResult('link', steps)] });

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]?.message).toContain('Button has role="link"');
        expect(result.summary.byIssue['button-as-link']).toBe(1);
    });

    it('reports a div given an interactive role', () => {
        const steps = createSteps([{ role: 'checkbox', name: 'Agree', htmlSnippet: '<div role="checkbox"></div>' }]);

        const result = analyzeRoleMismatch({ strategyResults: [strategyResult('tab', steps)] });

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]?.message).toContain('Non-interactive <div> has role="checkbox"');
        expect(result.summary.byIssue['div-as-interactive']).toBe(1);
    });

    it('reports a span given an interactive role', () => {
        const steps = createSteps([{ role: 'button', name: 'Menu', htmlSnippet: '<span role="button">Menu</span>' }]);

        const result = analyzeRoleMismatch({ strategyResults: [strategyResult('tab', steps)] });

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]?.message).toContain('Non-interactive <span> has role="button"');
        expect(result.summary.byIssue['span-as-interactive']).toBe(1);
    });

    it('reports a known element overridden to an unexpected interactive role', () => {
        const steps = createSteps([{ role: 'tab', name: 'Overview', htmlSnippet: '<li role="tab">Overview</li>' }]);

        const result = analyzeRoleMismatch({ strategyResults: [strategyResult('tab', steps)] });

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]?.message).toContain('<li> has unexpected role="tab"');
        expect(result.violations[0]?.message).toContain('Expected one of: listitem');
    });

    it.each([
        ['<a href="/plans">Plans</a>', 'link'],
        ['<button>Submit</button>', 'button'],
        ['<input type="text">', 'textbox'],
        ['<nav aria-label="Primary">', 'navigation'],
        ['<div class="wrapper">', 'generic'],
    ])('leaves %s alone when its role is "%s"', (htmlSnippet, role) => {
        const steps = createSteps([{ role, name: 'Element', htmlSnippet }]);

        const result = analyzeRoleMismatch({ strategyResults: [strategyResult('arrow', steps)] });

        expect(result.violations).toEqual([]);
    });

    it('skips elements with no HTML snippet', () => {
        const steps = createSteps([{ role: 'button', name: 'Ghost' }]);

        const result = analyzeRoleMismatch({ strategyResults: [strategyResult('button', steps)] });

        expect(result.violations).toEqual([]);
        expect(result.summary.totalElementsChecked).toBe(0);
    });

    it('checks an element once when several strategies reached it', () => {
        const steps = createSteps([
            { role: 'button', name: 'Buy now', htmlSnippet: '<a href="/buy" role="button">Buy now</a>' },
        ]);

        const result = analyzeRoleMismatch({
            strategyResults: [
                strategyResult('button', steps),
                strategyResult('tab', steps),
                strategyResult('arrow', steps),
            ],
        });

        expect(result.summary).toMatchObject({ totalElementsChecked: 1, violationsFound: 1 });
    });
});
