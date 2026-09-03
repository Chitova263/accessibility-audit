import { describe, it, expect } from 'vitest';
import { LandmarkWithoutHeadingRule } from './landmark-without-heading';
import { createSteps, strategyResult, mockContext } from '../../test-fixtures';
import type { StepOverrides } from '../../test-fixtures';

const rule = new LandmarkWithoutHeadingRule();

/** Steps NVDA announced as plain text — no heading, landmark or control keywords. */
const plain = (count: number): StepOverrides[] => Array.from({ length: count }, () => ({}));

const headingStep = (name: string, level = 2): StepOverrides => ({
    focusedElementText: name,
    spokenPhrases: [`${name} heading, level ${level}`],
});

const landmarkStep = (role: string): StepOverrides => ({
    focusedElementText: role,
    spokenPhrases: [`${role} landmark`],
});

const landmarkWalk = strategyResult('landmark', createSteps([{ role: 'banner', name: 'Header' }]));

describe('landmark-without-heading rule', () => {
    it('reports a substantial landmark that contains no heading', async () => {
        const arrow = strategyResult('arrow', createSteps([landmarkStep('banner'), ...plain(5)]));

        const result = await rule.run(mockContext([arrow, landmarkWalk]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.rule.id).toBe('landmark-without-heading');
        expect(result.violations[0]!.message).toContain('Landmark "banner landmark" contains 5 items');
    });

    it('leaves a landmark that does contain a heading alone', async () => {
        const arrow = strategyResult(
            'arrow',
            createSteps([landmarkStep('navigation'), headingStep('Menu'), ...plain(4)])
        );

        const result = await rule.run(mockContext([arrow, landmarkWalk]));

        expect(result.violations).toHaveLength(0);
    });

    it('leaves a small landmark alone', async () => {
        const arrow = strategyResult('arrow', createSteps([landmarkStep('banner'), ...plain(4)]));

        const result = await rule.run(mockContext([arrow, landmarkWalk]));

        expect(result.violations).toHaveLength(0);
    });

    it('honours a custom landmark item threshold', async () => {
        const arrow = strategyResult('arrow', createSteps([landmarkStep('banner'), ...plain(2)]));
        const customRule = new LandmarkWithoutHeadingRule(2);

        const result = await customRule.run(mockContext([arrow, landmarkWalk]));

        expect(result.violations).toHaveLength(1);
    });

    it('skips the analysis when no arrow walk ran', async () => {
        const result = await rule.run(mockContext([landmarkWalk]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.totalStepsAnalyzed).toBe(0);
    });
});
