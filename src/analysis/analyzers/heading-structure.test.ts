import { describe, it, expect } from 'vitest';
import { analyzeHeadingStructure } from './heading-structure';
import { createSteps, strategyResult } from './test-fixtures';
import type { StepOverrides } from './test-fixtures';

const heading = (level: number, name: string): StepOverrides => ({
    role: 'heading',
    level,
    name,
    itemText: name,
    identifier: `heading-${level}-${name}`,
    htmlSnippet: `<h${level}>${name}</h${level}>`,
});

describe('analyzeHeadingStructure', () => {
    it('accepts a well-formed outline', () => {
        const steps = createSteps([heading(1, 'Mobile plans'), heading(2, 'Data'), heading(3, 'Roaming')]);

        const result = analyzeHeadingStructure({ strategyResults: [strategyResult('heading', steps)] });

        expect(result.violations).toEqual([]);
        expect(result.summary).toMatchObject({ totalHeadings: 3, headingSequence: [1, 2, 3] });
    });

    it('reports a page whose headings start below H1', () => {
        const steps = createSteps([heading(2, 'About'), heading(3, 'Team')]);

        const result = analyzeHeadingStructure({ strategyResults: [strategyResult('heading', steps)] });

        expect(result.violations.map((v) => v.ruleId)).toEqual(['missing-h1']);
        expect(result.violations[0]?.message).toContain('First heading found is H2');
        expect(result.summary.byIssue['missing-h1']).toBe(1);
    });

    it('stays silent when the page has no headings at all', () => {
        const result = analyzeHeadingStructure({ strategyResults: [strategyResult('heading', [])] });

        expect(result.violations).toEqual([]);
        expect(result.summary.totalHeadings).toBe(0);
    });

    it('flags every H1 after the first', () => {
        const steps = createSteps([heading(1, 'First'), heading(1, 'Second'), heading(1, 'Third')]);

        const result = analyzeHeadingStructure({ strategyResults: [strategyResult('heading', steps)] });

        expect(result.violations.map((v) => v.ruleId)).toEqual(['multiple-h1', 'multiple-h1']);
        expect(result.violations[0]?.message).toContain('this is H1 #2');
        expect(result.violations[1]?.message).toContain('this is H1 #3');
        expect(result.summary.byIssue['multiple-h1']).toBe(2);
    });

    it('reports a skipped level going down the outline', () => {
        const steps = createSteps([heading(1, 'Overview'), heading(3, 'Details')]);

        const result = analyzeHeadingStructure({ strategyResults: [strategyResult('heading', steps)] });

        expect(result.violations.map((v) => v.ruleId)).toEqual(['heading-level-skipped']);
        expect(result.violations[0]?.message).toContain('H1 → H3');
        expect(result.violations[0]?.message).toContain('Expected H2');
    });

    it('allows jumping back up several levels', () => {
        const steps = createSteps([heading(1, 'A'), heading(2, 'B'), heading(3, 'C'), heading(2, 'D')]);

        const result = analyzeHeadingStructure({ strategyResults: [strategyResult('heading', steps)] });

        expect(result.violations).toEqual([]);
    });

    it('reports a heading with no text', () => {
        const steps = createSteps([heading(1, 'Home'), { role: 'heading', level: 2, name: '', itemText: '' }]);

        const result = analyzeHeadingStructure({ strategyResults: [strategyResult('heading', steps)] });

        expect(result.violations.map((v) => v.ruleId)).toEqual(['empty-heading']);
        expect(result.violations[0]?.message).toContain('H2 heading has no text content');
    });

    it('counts a heading once when several heading strategies reached it', () => {
        const steps = createSteps([heading(1, 'Mobile plans')]);

        const result = analyzeHeadingStructure({
            strategyResults: [
                strategyResult('heading', steps),
                strategyResult('heading1', steps),
                strategyResult('heading2', steps),
            ],
        });

        expect(result.summary.totalHeadings).toBe(1);
        expect(result.violations).toEqual([]);
    });

    it('ignores headings surfaced by non-heading strategies', () => {
        const steps = createSteps([heading(2, 'Orphan')]);

        const result = analyzeHeadingStructure({
            strategyResults: [strategyResult('link', steps), strategyResult('tab', steps)],
        });

        expect(result.summary.totalHeadings).toBe(0);
        expect(result.violations).toEqual([]);
    });

    it('ignores non-heading nodes inside a heading strategy', () => {
        const steps = createSteps([heading(1, 'Real'), { role: 'link', name: 'Not a heading' }]);

        const result = analyzeHeadingStructure({ strategyResults: [strategyResult('heading', steps)] });

        expect(result.summary.headingSequence).toEqual([1]);
    });
});
