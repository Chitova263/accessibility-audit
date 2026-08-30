import { describe, it, expect } from 'vitest';
import type { TranscriptContext } from '../context';
import {
    analyzeStepsToMainContent,
    analyzeReadingOrderLandmarkSequence,
    analyzeExcessiveRepetition,
    analyzeContentDensityPerRegion,
} from './arrow-navigation';
import type {
    StrategyResult,
    NavigationStep,
} from '../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

const createStep = (
    index: number,
    overrides: Partial<{ itemText: string; spokenPhrases: string[]; role: string }> = {}
): NavigationStep => ({
    index,
    identifier: `step-${index}`,
    spokenPhrases: overrides.spokenPhrases ?? [overrides.itemText ?? `Item ${index}`],
    itemText: overrides.itemText ?? `Item ${index}`,
    itemTextLog: [],
    timestamp: 1_700_000_000_000 + index,
    axNode: overrides.role ? ({ nodeId: `${index}`, role: { value: overrides.role } } as never) : undefined,
    htmlSnippet: null,
});

const arrowResult = (navigationSteps: NavigationStep[]): TranscriptContext => ({
    strategyResults: [
        {
            meta: { name: 'ArrowNavigation', description: 'Linear reading', type: 'arrow', mode: 'browse' },
            navigationSteps,
            completionReason: { kind: 'exhausted', detail: 'reached end of document' },
        },
    ],
});

describe('analyzeStepsToMainContent', () => {
    it('reports a missing main landmark when linear reading never announces one', () => {
        const result = analyzeStepsToMainContent(arrowResult([createStep(0), createStep(1)]));

        expect(result.summary.mainFound).toBe(false);
        expect(result.violations.map((v) => v.ruleId)).toEqual(['missing-main-landmark']);
    });

    it('does not report a missing main landmark when there are no steps to read', () => {
        const result = analyzeStepsToMainContent(arrowResult([]));

        expect(result.violations).toEqual([]);
    });

    it('stays silent when main is reached within the threshold', () => {
        const steps = [...Array(5)].map((_, i) => createStep(i));
        steps.push(createStep(5, { role: 'main' }));

        const result = analyzeStepsToMainContent(arrowResult(steps), { threshold: 30 });

        expect(result.summary.mainFound).toBe(true);
        expect(result.summary.stepsToMain).toBe(5);
        expect(result.violations).toEqual([]);
    });

    it('reports excessive steps when main is reached beyond the threshold', () => {
        const steps = [...Array(10)].map((_, i) => createStep(i));
        steps.push(createStep(10, { role: 'main' }));

        const result = analyzeStepsToMainContent(arrowResult(steps), { threshold: 3 });

        expect(result.violations.map((v) => v.ruleId)).toEqual(['steps-to-main-content']);
    });
});

describe('analyzeReadingOrderLandmarkSequence', () => {
    it('does not treat ordinary content containing landmark words as landmarks', () => {
        const result = analyzeReadingOrderLandmarkSequence(
            arrowResult([
                createStep(0, { itemText: 'Choose your domain name' }),
                createStep(1, { itemText: 'Park beside the entrance' }),
                createStep(2, { itemText: 'Scheduled maintenance tonight' }),
                createStep(3, { itemText: 'Read the footer notes below' }),
            ])
        );

        expect(result.summary.landmarkSequence).toEqual([]);
        expect(result.violations).toEqual([]);
    });

    it('detects landmarks from spoken announcements', () => {
        const result = analyzeReadingOrderLandmarkSequence(
            arrowResult([
                createStep(0, { itemText: 'banner landmark' }),
                createStep(1, { itemText: 'main landmark' }),
                createStep(2, { itemText: 'content info landmark' }),
            ])
        );

        expect(result.summary.landmarkSequence.map((l) => l.landmark)).toEqual(['banner', 'main', 'contentinfo']);
        expect(result.violations).toEqual([]);
    });

    it('reports contentinfo announced before main', () => {
        const result = analyzeReadingOrderLandmarkSequence(
            arrowResult([
                createStep(0, { itemText: 'content info landmark' }),
                createStep(1, { itemText: 'main landmark' }),
            ])
        );

        expect(result.summary.hasMainBeforeFooter).toBe(false);
        expect(result.violations.map((v) => v.ruleId)).toEqual(['reading-order-landmark-sequence']);
    });

    it('reports complementary announced before main', () => {
        const result = analyzeReadingOrderLandmarkSequence(
            arrowResult([
                createStep(0, { itemText: 'complementary landmark' }),
                createStep(1, { itemText: 'main landmark' }),
            ])
        );

        expect(result.summary.hasMainBeforeAside).toBe(false);
        expect(result.violations).toHaveLength(1);
    });
});

describe('analyzeExcessiveRepetition', () => {
    it('tolerates short runs of repeated announcements by default', () => {
        const steps = [...Array(4)].map((_, i) => createStep(i, { itemText: 'Add to basket' }));

        const result = analyzeExcessiveRepetition(arrowResult(steps));

        expect(result.summary.threshold).toBe(5);
        expect(result.violations).toEqual([]);
    });

    it('reports runs that reach the threshold', () => {
        const steps = [...Array(6)].map((_, i) => createStep(i, { itemText: 'Add to basket' }));

        const result = analyzeExcessiveRepetition(arrowResult(steps));

        expect(result.violations.map((v) => v.ruleId)).toEqual(['excessive-repetition']);
        expect(result.summary.repetitions[0]?.count).toBe(6);
    });
});

describe('analyzeContentDensityPerRegion', () => {
    it('records dense navigation regions but leaves the violation to navigation-size', () => {
        const steps = [createStep(0, { itemText: 'navigation landmark' })];
        for (let i = 1; i <= 60; i++) {
            steps.push(createStep(i, { itemText: `Nav link ${i}` }));
        }

        const result = analyzeContentDensityPerRegion(arrowResult(steps), { threshold: 50 });

        expect(result.summary.regions[0]).toMatchObject({ landmark: 'navigation', exceedsThreshold: true });
        expect(result.violations).toEqual([]);
    });

    it('reports dense non-navigation regions', () => {
        const steps = [createStep(0, { itemText: 'main landmark' })];
        for (let i = 1; i <= 60; i++) {
            steps.push(createStep(i, { itemText: `Content ${i}` }));
        }

        const result = analyzeContentDensityPerRegion(arrowResult(steps), { threshold: 50 });

        expect(result.violations.map((v) => v.ruleId)).toEqual(['content-density-per-region']);
    });
});
