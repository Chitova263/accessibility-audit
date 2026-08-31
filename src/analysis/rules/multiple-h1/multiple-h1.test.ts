import { describe, it, expect } from 'vitest';
import { rule } from './multiple-h1';
import { createSteps, strategyResult, mockContext } from '../test-fixtures';
import type { StepOverrides } from '../test-fixtures';

const heading = (level: number, name: string): StepOverrides => ({
    role: 'heading',
    level,
    name,
    itemText: name,
    identifier: `heading-${level}-${name}`,
    htmlSnippet: `<h${level}>${name}</h${level}>`,
});

describe('multiple-h1 rule', () => {
    it('has correct metadata', () => {
        expect(rule.id).toBe('multiple-h1');
        expect(rule.meta.impact).toBe('moderate');
        expect(rule.meta.wcag.primary.criterion).toBe('1.3.1');
    });

    it('flags every H1 after the first', async () => {
        const steps = createSteps([heading(1, 'First'), heading(1, 'Second'), heading(1, 'Third')]);

        const result = await rule.run(mockContext([strategyResult('heading', steps)]));

        expect(result.violations).toHaveLength(2);
        expect(result.violations[0]!.rule.id).toBe('multiple-h1');
        expect(result.violations[0]!.message).toContain('this is H1 #2');
        expect(result.violations[1]!.message).toContain('this is H1 #3');
        expect(result.stats).toMatchObject({
            h1Count: 3,
            violationsFound: 2,
        });
    });

    it('stays silent when page has exactly one H1', async () => {
        const steps = createSteps([heading(1, 'Welcome'), heading(2, 'About')]);

        const result = await rule.run(mockContext([strategyResult('heading', steps)]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.h1Count).toBe(1);
    });

    it('stays silent when page has no headings', async () => {
        const result = await rule.run(mockContext([strategyResult('heading', [])]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.h1Count).toBe(0);
    });

    it('ignores headings from non-heading strategies', async () => {
        const steps = createSteps([heading(1, 'One'), heading(1, 'Two')]);

        const result = await rule.run(mockContext([strategyResult('tab', steps)]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.totalHeadings).toBe(0);
    });
});
