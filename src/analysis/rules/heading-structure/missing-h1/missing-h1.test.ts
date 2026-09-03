import { describe, it, expect } from 'vitest';
import { rule } from './missing-h1';
import { createSteps, strategyResult, mockContext } from '../../test-fixtures';
import type { StepOverrides } from '../../test-fixtures';

const heading = (level: number, name: string): StepOverrides => ({
    role: 'heading',
    level,
    name,
    focusedElementText: name,
    identifier: `heading-${level}-${name}`,
    htmlSnippet: `<h${level}>${name}</h${level}>`,
});

describe('missing-h1 rule', () => {
    it('has correct metadata', () => {
        expect(rule.id).toBe('missing-h1');
        expect(rule.meta.impact).toBe('serious');
        expect(rule.meta.wcag.primary.criterion).toBe('1.3.1');
    });

    it('reports when headings start below H1', async () => {
        const steps = createSteps([heading(2, 'About'), heading(3, 'Team')]);

        const result = await rule.run(mockContext([strategyResult('heading', steps)]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.rule.id).toBe('missing-h1');
        expect(result.violations[0]!.message).toContain('First heading found is H2');
        expect(result.stats).toMatchObject({
            totalHeadings: 2,
            h1Count: 0,
            violationsFound: 1,
        });
    });

    it('stays silent when page has H1', async () => {
        const steps = createSteps([heading(1, 'Welcome'), heading(2, 'About')]);

        const result = await rule.run(mockContext([strategyResult('heading', steps)]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.h1Count).toBe(1);
    });

    it('stays silent when page has no headings at all', async () => {
        const result = await rule.run(mockContext([strategyResult('heading', [])]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.totalHeadings).toBe(0);
    });

    it('ignores headings surfaced by non-heading strategies', async () => {
        const steps = createSteps([heading(2, 'Orphan')]);

        const result = await rule.run(mockContext([strategyResult('link', steps), strategyResult('tab', steps)]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.totalHeadings).toBe(0);
    });
});
