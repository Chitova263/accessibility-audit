import { describe, it, expect } from 'vitest';
import { LargeContentGapRule } from './large-content-gap';
import { createSteps, strategyResult, mockContext } from '../../test-fixtures';
import type { StepOverrides } from '../../test-fixtures';

const rule = new LargeContentGapRule();

/** Steps NVDA announced as plain text — no heading, landmark or control keywords. */
const plain = (count: number): StepOverrides[] => Array.from({ length: count }, () => ({}));

const headingStep = (name: string, level = 2): StepOverrides => ({
    focusedElementText: name,
    spokenPhrases: [`${name} heading, level ${level}`],
});

const mainLandmarkStep = (text = 'Main content'): StepOverrides => ({
    focusedElementText: `main landmark, ${text}`,
    spokenPhrases: [`main landmark, ${text}`],
});

const contentInfoLandmarkStep = (text = 'Footer'): StepOverrides => ({
    focusedElementText: `content info landmark, ${text}`,
    spokenPhrases: [`content info landmark, ${text}`],
});

const bannerLandmarkStep = (text = 'Header'): StepOverrides => ({
    focusedElementText: `banner landmark, ${text}`,
    spokenPhrases: [`banner landmark, ${text}`],
});

const navigationLandmarkStep = (text = 'Nav'): StepOverrides => ({
    focusedElementText: `navigation landmark, ${text}`,
    spokenPhrases: [`navigation landmark, ${text}`],
});

const headingWalk = strategyResult('heading', []);

describe('large-content-gap rule', () => {
    describe('main landmark scoping', () => {
        it('only analyzes content within main landmark', async () => {
            const arrow = strategyResult(
                'arrow',
                createSteps([
                    bannerLandmarkStep('Site logo'),
                    ...plain(20), // Header content - should be ignored
                    mainLandmarkStep('Welcome'),
                    ...plain(16), // Main content without headings - should flag
                    contentInfoLandmarkStep('Footer links'),
                    ...plain(10), // Footer content - should be ignored
                ])
            );

            const result = await rule.run(mockContext([arrow, headingWalk]));

            expect(result.violations).toHaveLength(1);
            expect(result.violations[0]!.message).toContain('17 items'); // main landmark step + 16 plain
            expect(result.stats!.mainContentSteps).toBe(17);
        });

        it('ignores content before main landmark', async () => {
            const arrow = strategyResult(
                'arrow',
                createSteps([
                    ...plain(30), // Lots of header content - no main landmark yet
                    mainLandmarkStep('Article'),
                    headingStep('Introduction'),
                    ...plain(5),
                ])
            );

            const result = await rule.run(mockContext([arrow, headingWalk]));

            expect(result.violations).toHaveLength(0);
            expect(result.stats!.mainContentSteps).toBe(7); // main + heading + 5 plain
        });

        it('ignores content after main landmark ends', async () => {
            const arrow = strategyResult(
                'arrow',
                createSteps([
                    mainLandmarkStep('Content'),
                    headingStep('Section'),
                    ...plain(5),
                    contentInfoLandmarkStep('Legal'),
                    ...plain(25), // Footer junk - should be ignored
                ])
            );

            const result = await rule.run(mockContext([arrow, headingWalk]));

            expect(result.violations).toHaveLength(0);
        });

        it('returns no violations when main landmark is not found', async () => {
            const arrow = strategyResult(
                'arrow',
                createSteps([bannerLandmarkStep('Header'), ...plain(30), contentInfoLandmarkStep('Footer')])
            );

            const result = await rule.run(mockContext([arrow, headingWalk]));

            expect(result.violations).toHaveLength(0);
            expect(result.stats!.mainContentSteps).toBe(0);
        });

        it('handles main landmark that extends to end of page', async () => {
            const arrow = strategyResult(
                'arrow',
                createSteps([
                    navigationLandmarkStep('Menu'),
                    ...plain(5),
                    mainLandmarkStep('Page content'),
                    ...plain(20), // No footer landmark, main extends to end
                ])
            );

            const result = await rule.run(mockContext([arrow, headingWalk]));

            expect(result.violations).toHaveLength(1);
            expect(result.violations[0]!.message).toContain('21 items'); // main landmark + 20 plain
        });
    });

    describe('gap detection within main', () => {
        it('reports a gap when main has no headings at all', async () => {
            const arrow = strategyResult(
                'arrow',
                createSteps([mainLandmarkStep('Start'), ...plain(20), contentInfoLandmarkStep('End')])
            );

            const result = await rule.run(mockContext([arrow, headingWalk]));

            expect(result.violations).toHaveLength(1);
            expect(result.violations[0]!.message).toContain('Large content section (21 items)');
        });

        it('reports the run-up to the first heading within main', async () => {
            const arrow = strategyResult(
                'arrow',
                createSteps([mainLandmarkStep('Content'), ...plain(16), headingStep('Overview'), ...plain(3)])
            );

            const result = await rule.run(mockContext([arrow, headingWalk]));

            expect(result.violations).toHaveLength(1);
            expect(result.violations[0]!.message).toContain('17 items'); // main step + 16 plain
        });

        it('reports a gap between two headings in main', async () => {
            const arrow = strategyResult(
                'arrow',
                createSteps([
                    mainLandmarkStep('Content'),
                    headingStep('Overview'),
                    ...plain(16),
                    headingStep('Details'),
                    ...plain(3),
                ])
            );

            const result = await rule.run(mockContext([arrow, headingWalk]));

            expect(result.violations).toHaveLength(1);
            expect(result.violations[0]!.message).toContain('16 items');
        });

        it('leaves well-structured main content alone', async () => {
            const arrow = strategyResult(
                'arrow',
                createSteps([
                    mainLandmarkStep('Article'),
                    headingStep('Introduction'),
                    ...plain(10),
                    headingStep('Body'),
                    ...plain(10),
                    headingStep('Conclusion'),
                    ...plain(5),
                ])
            );

            const result = await rule.run(mockContext([arrow, headingWalk]));

            expect(result.violations).toHaveLength(0);
        });

        it('reports multiple gaps in a single main region', async () => {
            const arrow = strategyResult(
                'arrow',
                createSteps([
                    mainLandmarkStep('Content'),
                    headingStep('Section 1'),
                    ...plain(20), // Gap 1
                    headingStep('Section 2'),
                    ...plain(18), // Gap 2
                    headingStep('Section 3'),
                ])
            );

            const result = await rule.run(mockContext([arrow, headingWalk]));

            expect(result.violations).toHaveLength(2);
        });
    });

    describe('threshold configuration', () => {
        it('honours a custom gap threshold', async () => {
            const arrow = strategyResult('arrow', createSteps([mainLandmarkStep('Content'), ...plain(6)]));
            const customRule = new LargeContentGapRule(5);

            const result = await customRule.run(mockContext([arrow, headingWalk]));

            expect(result.violations).toHaveLength(1);
            expect(result.violations[0]!.message).toContain('Threshold: 5 items');
        });

        it('does not flag gaps below threshold', async () => {
            const arrow = strategyResult('arrow', createSteps([mainLandmarkStep('Content'), ...plain(13)]));

            const result = await rule.run(mockContext([arrow, headingWalk]));

            expect(result.violations).toHaveLength(0); // 14 items total, below default threshold of 15
        });
    });

    describe('edge cases', () => {
        it('skips the gap analysis when no arrow walk ran', async () => {
            const result = await rule.run(mockContext([headingWalk]));

            expect(result.violations).toHaveLength(0);
            expect(result.stats!.totalStepsAnalyzed).toBe(0);
        });

        it('handles empty main landmark', async () => {
            const arrow = strategyResult(
                'arrow',
                createSteps([mainLandmarkStep('Content'), contentInfoLandmarkStep('Footer')])
            );

            const result = await rule.run(mockContext([arrow, headingWalk]));

            expect(result.violations).toHaveLength(0);
            expect(result.stats!.mainContentSteps).toBe(1); // Just the main landmark entry
        });

        it('provides original step indices in violation message', async () => {
            const arrow = strategyResult(
                'arrow',
                createSteps([
                    bannerLandmarkStep('Header'),
                    ...plain(10), // Steps 1-10 (header)
                    mainLandmarkStep('Content'), // Step 11
                    ...plain(20), // Steps 12-31 (main content gap)
                    contentInfoLandmarkStep('Footer'),
                ])
            );

            const result = await rule.run(mockContext([arrow, headingWalk]));

            expect(result.violations).toHaveLength(1);
            // Should reference original indices (11-31), not relative indices (0-20)
            expect(result.violations[0]!.message).toContain('steps 11 and 31');
        });
    });
});
