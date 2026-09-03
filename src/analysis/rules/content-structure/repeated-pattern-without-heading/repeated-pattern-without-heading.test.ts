import { describe, it, expect } from 'vitest';
import { RepeatedPatternWithoutHeadingRule } from './repeated-pattern-without-heading';
import { createSteps, strategyResult, mockContext } from '../../test-fixtures';
import type { StepOverrides } from '../../test-fixtures';

const rule = new RepeatedPatternWithoutHeadingRule();

const headingStep = (name: string, level = 2): StepOverrides => ({
    focusedElementText: name,
    spokenPhrases: [`${name} heading, level ${level}`],
});

const clickableStep = (name: string): StepOverrides => ({
    focusedElementText: name,
    spokenPhrases: [`${name} clickable`],
});

describe('repeated-pattern-without-heading rule', () => {
    it('reports a run of clickable items with no heading in front of it', async () => {
        const arrow = strategyResult(
            'arrow',
            createSteps([clickableStep('Plan S'), clickableStep('Plan M'), clickableStep('Plan L')])
        );

        const result = await rule.run(mockContext([arrow]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.rule.id).toBe('repeated-pattern-without-heading');
        expect(result.violations[0]!.message).toContain('3 similar "clickable items"');
    });

    it('accepts the same run when a heading introduces it', async () => {
        const arrow = strategyResult(
            'arrow',
            createSteps([
                headingStep('Plans'),
                clickableStep('Plan S'),
                clickableStep('Plan M'),
                clickableStep('Plan L'),
            ])
        );

        const result = await rule.run(mockContext([arrow]));

        expect(result.violations).toHaveLength(0);
    });

    it('ignores a run shorter than the repetition threshold', async () => {
        const arrow = strategyResult('arrow', createSteps([clickableStep('Plan S'), clickableStep('Plan M')]));

        const result = await rule.run(mockContext([arrow]));

        expect(result.violations).toHaveLength(0);
    });

    it('honours a custom repetition threshold', async () => {
        const arrow = strategyResult('arrow', createSteps([clickableStep('Plan S'), clickableStep('Plan M')]));
        const customRule = new RepeatedPatternWithoutHeadingRule(2);

        const result = await customRule.run(mockContext([arrow]));

        expect(result.violations).toHaveLength(1);
    });

    it('skips the analysis when no arrow walk ran', async () => {
        const result = await rule.run(mockContext([strategyResult('heading', [])]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.totalStepsAnalyzed).toBe(0);
    });
});
