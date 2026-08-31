import { describe, it, expect } from 'vitest';
import { LargeContentGapRule } from './large-content-gap';
import { createSteps, strategyResult, mockContext } from '../test-fixtures';
import type { StepOverrides } from '../test-fixtures';

const rule = new LargeContentGapRule();

/** Steps NVDA announced as plain text — no heading, landmark or control keywords. */
const plain = (count: number): StepOverrides[] => Array.from({ length: count }, () => ({}));

const headingStep = (name: string, level = 2): StepOverrides => ({
    itemText: name,
    spokenPhrases: [`${name} heading, level ${level}`],
});

const headingWalk = strategyResult('heading', []);

describe('large-content-gap rule', () => {
    it('has correct metadata', () => {
        expect(rule.id).toBe('large-content-gap');
        expect(rule.meta.impact).toBe('moderate');
        expect(rule.meta.wcag.primary.criterion).toBe('1.3.1');
    });

    it('reports a long stretch of content with no headings at all', async () => {
        const arrow = strategyResult('arrow', createSteps(plain(20)));

        const result = await rule.run(mockContext([arrow, headingWalk]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.rule.id).toBe('large-content-gap');
        expect(result.violations[0]!.message).toContain('Large content section (20 items)');
        expect(result.violations[0]!.message).toContain('between steps 0 and 19');
    });

    it('reports the run-up to the first heading', async () => {
        const arrow = strategyResult('arrow', createSteps([...plain(16), headingStep('Overview')]));

        const result = await rule.run(mockContext([arrow, headingWalk]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.message).toContain('Large content section (16 items)');
        expect(result.violations[0]!.message).toContain('between steps 0 and 15');
    });

    it('reports a gap between two headings', async () => {
        const arrow = strategyResult(
            'arrow',
            createSteps([headingStep('Overview'), ...plain(16), headingStep('Details')])
        );

        const result = await rule.run(mockContext([arrow, headingWalk]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.message).toContain('Large content section (16 items)');
        expect(result.violations[0]!.message).toContain('between steps 1 and 16');
    });

    it('leaves a well-signposted page alone', async () => {
        const arrow = strategyResult(
            'arrow',
            createSteps([headingStep('Overview'), ...plain(10), headingStep('Details'), ...plain(10)])
        );

        const result = await rule.run(mockContext([arrow, headingWalk]));

        expect(result.violations).toHaveLength(0);
    });

    it('honours a custom gap threshold', async () => {
        const arrow = strategyResult('arrow', createSteps(plain(6)));
        const customRule = new LargeContentGapRule(5);

        const result = await customRule.run(mockContext([arrow, headingWalk]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.message).toContain('Threshold: 5 items');
    });

    it('skips the gap analysis when no arrow walk ran', async () => {
        const result = await rule.run(mockContext([headingWalk]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.totalStepsAnalyzed).toBe(0);
    });
});
