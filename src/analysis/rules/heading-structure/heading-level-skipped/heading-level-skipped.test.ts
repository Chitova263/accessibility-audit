import { describe, it, expect } from 'vitest';
import { rule } from './heading-level-skipped';
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

describe('heading-level-skipped rule', () => {
    it('reports a skipped level going down the outline', async () => {
        const steps = createSteps([heading(1, 'Overview'), heading(3, 'Details')]);

        const result = await rule.run(mockContext([strategyResult('heading', steps)]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.rule.id).toBe('heading-level-skipped');
        expect(result.violations[0]!.message).toContain('H1 → H3');
        expect(result.violations[0]!.message).toContain('Expected H2');
        expect(result.stats).toMatchObject({
            headingSequence: [1, 3],
            violationsFound: 1,
        });
    });

    it('allows jumping back up several levels', async () => {
        const steps = createSteps([heading(1, 'A'), heading(2, 'B'), heading(3, 'C'), heading(2, 'D')]);

        const result = await rule.run(mockContext([strategyResult('heading', steps)]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.headingSequence).toEqual([1, 2, 3, 2]);
    });

    it('accepts well-formed outline', async () => {
        const steps = createSteps([heading(1, 'Mobile plans'), heading(2, 'Data'), heading(3, 'Roaming')]);

        const result = await rule.run(mockContext([strategyResult('heading', steps)]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.headingSequence).toEqual([1, 2, 3]);
    });

    it('reports multiple skipped levels', async () => {
        const steps = createSteps([heading(1, 'A'), heading(4, 'B'), heading(2, 'C'), heading(5, 'D')]);

        const result = await rule.run(mockContext([strategyResult('heading', steps)]));

        expect(result.violations).toHaveLength(2);
        expect(result.violations[0]!.message).toContain('H1 → H4');
        expect(result.violations[1]!.message).toContain('H2 → H5');
    });

    it('ignores headings from non-heading strategies', async () => {
        const steps = createSteps([heading(1, 'A'), heading(4, 'B')]);

        const result = await rule.run(mockContext([strategyResult('tab', steps)]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.totalHeadings).toBe(0);
    });
});
