import { describe, it, expect } from 'vitest';
import { rule } from './empty-heading';
import { createSteps, strategyResult, mockContext } from '../../test-fixtures';
import type { StepOverrides } from '../../test-fixtures';

const heading = (level: number, name: string): StepOverrides => ({
    role: 'heading',
    level,
    name,
    itemText: name,
    identifier: `heading-${level}-${name}`,
    htmlSnippet: `<h${level}>${name}</h${level}>`,
});

describe('empty-heading rule', () => {
    it('has correct metadata', () => {
        expect(rule.id).toBe('empty-heading');
        expect(rule.meta.impact).toBe('serious');
        expect(rule.meta.wcag.primary.criterion).toBe('1.3.1');
    });

    it('reports a heading with no text', async () => {
        const steps = createSteps([heading(1, 'Home'), { role: 'heading', level: 2, name: '', itemText: '' }]);

        const result = await rule.run(mockContext([strategyResult('heading', steps)]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.rule.id).toBe('empty-heading');
        expect(result.violations[0]!.message).toContain('H2 heading has no text content');
        expect(result.stats).toMatchObject({
            totalHeadings: 2,
            violationsFound: 1,
        });
    });

    it('treats whitespace-only name as empty', async () => {
        const steps = createSteps([{ role: 'heading', level: 1, name: '   ', itemText: '   ' }]);

        const result = await rule.run(mockContext([strategyResult('heading', steps)]));

        expect(result.violations).toHaveLength(1);
    });

    it('stays silent when all headings have text', async () => {
        const steps = createSteps([heading(1, 'Welcome'), heading(2, 'About')]);

        const result = await rule.run(mockContext([strategyResult('heading', steps)]));

        expect(result.violations).toHaveLength(0);
    });

    it('reports multiple empty headings', async () => {
        const steps = createSteps([
            { role: 'heading', level: 1, name: '', itemText: '' },
            heading(2, 'Good'),
            { role: 'heading', level: 3, name: '', itemText: '' },
        ]);

        const result = await rule.run(mockContext([strategyResult('heading', steps)]));

        expect(result.violations).toHaveLength(2);
        expect(result.stats!.violationsFound).toBe(2);
    });

    it('ignores headings from non-heading strategies', async () => {
        const steps = createSteps([{ role: 'heading', level: 1, name: '', itemText: '' }]);

        const result = await rule.run(mockContext([strategyResult('tab', steps)]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.totalHeadings).toBe(0);
    });
});
