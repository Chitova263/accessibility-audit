import { describe, it, expect } from 'vitest';
import { analyzeContentGrouping } from './content-grouping';
import { createSteps, strategyResult, mockContext } from '../test-fixtures';
import type { StepOverrides } from '../test-fixtures';
import type { StrategyResult } from '../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

/** Steps NVDA announced as plain text — no heading, landmark or control keywords. */
const plain = (count: number): StepOverrides[] => Array.from({ length: count }, () => ({}));

const headingStep = (name: string, level = 2): StepOverrides => ({
    itemText: name,
    spokenPhrases: [`${name} heading, level ${level}`],
});

const landmarkStep = (role: string): StepOverrides => ({
    itemText: role,
    spokenPhrases: [`${role} landmark`],
});

const clickableStep = (name: string): StepOverrides => ({
    itemText: name,
    spokenPhrases: [`${name} clickable`],
});

/** The heading and landmark walks only need to exist; their steps are not read. */
const headingWalk = strategyResult('heading', []);
const landmarkWalk = strategyResult('landmark', createSteps([{ role: 'banner', name: 'Header' }]));

describe('analyzeContentGrouping large content gaps', () => {
    it('reports a long stretch of content with no headings at all', async () => {
        const arrow = strategyResult('arrow', createSteps(plain(20)));

        const result = await analyzeContentGrouping(mockContext([arrow, headingWalk]));

        expect(result.violations.map((v) => v.rule.id)).toEqual(['large-content-gap']);
        expect(result.violations[0]).toMatchObject({ rule: { impact: 'moderate' } });
        expect(result.violations[0]?.message).toContain('Large content section (20 items)');
        expect(result.violations[0]?.message).toContain('between steps 0 and 19');
    });

    it('reports the run-up to the first heading', async () => {
        const arrow = strategyResult('arrow', createSteps([...plain(16), headingStep('Overview')]));

        const result = await analyzeContentGrouping(mockContext([arrow, headingWalk]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]?.message).toContain('Large content section (16 items)');
        expect(result.violations[0]?.message).toContain('between steps 0 and 15');
    });

    it('reports a gap between two headings', async () => {
        const arrow = strategyResult(
            'arrow',
            createSteps([headingStep('Overview'), ...plain(16), headingStep('Details')])
        );

        const result = await analyzeContentGrouping(mockContext([arrow, headingWalk]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]?.message).toContain('Large content section (16 items)');
        expect(result.violations[0]?.message).toContain('between steps 1 and 16');
    });

    it('leaves a well-signposted page alone', async () => {
        const arrow = strategyResult(
            'arrow',
            createSteps([headingStep('Overview'), ...plain(10), headingStep('Details'), ...plain(10)])
        );

        const result = await analyzeContentGrouping(mockContext([arrow, headingWalk]));

        expect(result.violations).toEqual([]);
    });

    it('honours a custom gap threshold', async () => {
        const arrow = strategyResult('arrow', createSteps(plain(6)));

        const result = await analyzeContentGrouping(mockContext([arrow, headingWalk]), { gapThreshold: 5 });

        expect(result.violations.map((v) => v.rule.id)).toEqual(['large-content-gap']);
        expect(result.violations[0]?.message).toContain('Threshold: 5 items');
    });

    it('skips the gap analysis when no heading walk ran', async () => {
        const arrow = strategyResult('arrow', createSteps(plain(20)));

        const result = await analyzeContentGrouping(mockContext([arrow]));

        expect(result.violations).toEqual([]);
    });
});

describe('analyzeContentGrouping landmarks without headings', () => {
    it('reports a substantial landmark that contains no heading', async () => {
        const arrow = strategyResult('arrow', createSteps([landmarkStep('banner'), ...plain(5)]));

        const result = await analyzeContentGrouping(mockContext([arrow, landmarkWalk]));

        expect(result.violations.map((v) => v.rule.id)).toEqual(['landmark-without-heading']);
        expect(result.violations[0]?.message).toContain('Landmark "banner landmark" contains 5 items');
    });

    it('leaves a landmark that does contain a heading alone', async () => {
        const arrow = strategyResult(
            'arrow',
            createSteps([landmarkStep('navigation'), headingStep('Menu'), ...plain(4)])
        );

        const result = await analyzeContentGrouping(mockContext([arrow, landmarkWalk]));

        expect(result.violations).toEqual([]);
    });

    it('leaves a small landmark alone', async () => {
        const arrow = strategyResult('arrow', createSteps([landmarkStep('banner'), ...plain(4)]));

        const result = await analyzeContentGrouping(mockContext([arrow, landmarkWalk]));

        expect(result.violations).toEqual([]);
    });

    it('honours a custom landmark item threshold', async () => {
        const arrow = strategyResult('arrow', createSteps([landmarkStep('banner'), ...plain(2)]));

        const result = await analyzeContentGrouping(mockContext([arrow, landmarkWalk]), { landmarkItemThreshold: 2 });

        expect(result.violations.map((v) => v.rule.id)).toEqual(['landmark-without-heading']);
    });
});

describe('analyzeContentGrouping repeated patterns', () => {
    it('reports a run of clickable items with no heading in front of it', async () => {
        const arrow = strategyResult(
            'arrow',
            createSteps([clickableStep('Plan S'), clickableStep('Plan M'), clickableStep('Plan L')])
        );

        const result = await analyzeContentGrouping(mockContext([arrow]));

        expect(result.violations.map((v) => v.rule.id)).toEqual(['repeated-pattern-without-heading']);
        expect(result.violations[0]).toMatchObject({ rule: { impact: 'minor' } });
        expect(result.violations[0]?.message).toContain('3 similar "clickable items"');
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

        const result = await analyzeContentGrouping(mockContext([arrow]));

        expect(result.violations).toEqual([]);
    });

    it('ignores a run shorter than the repetition threshold', async () => {
        const arrow = strategyResult('arrow', createSteps([clickableStep('Plan S'), clickableStep('Plan M')]));

        const result = await analyzeContentGrouping(mockContext([arrow]));

        expect(result.violations).toEqual([]);
    });

    it('honours a custom repetition threshold', async () => {
        const arrow = strategyResult('arrow', createSteps([clickableStep('Plan S'), clickableStep('Plan M')]));

        const result = await analyzeContentGrouping(mockContext([arrow]), { repetitionThreshold: 2 });

        expect(result.violations.map((v) => v.rule.id)).toEqual(['repeated-pattern-without-heading']);
    });
});

describe('analyzeContentGrouping inputs', () => {
    it('has nothing to analyse without a linear reading walk', async () => {
        const result = await analyzeContentGrouping(mockContext([headingWalk, landmarkWalk]));

        expect(result.violations).toEqual([]);
        expect(result.summary).toMatchObject({ totalGapsAnalyzed: 0, patternsAnalyzed: 0 });
    });

    it('finds the linear reading walk by strategy name when the type is missing', async () => {
        const arrow: StrategyResult = {
            meta: { name: 'ArrowNavigation', description: 'Linear reading', mode: 'browse' },
            navigationSteps: createSteps(plain(20)),
            completionReason: { kind: 'exhausted', detail: 'reached end of document' },
        };

        const result = await analyzeContentGrouping(mockContext([arrow, headingWalk]));

        expect(result.violations.map((v) => v.rule.id)).toEqual(['large-content-gap']);
        expect(result.summary.totalGapsAnalyzed).toBe(20);
    });
});
