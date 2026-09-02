/**
 * Rule: Landmark Without Heading
 *
 * Detects landmark regions that contain many items but no heading, making it
 * difficult for screen reader users to understand the section's purpose.
 *
 * Maps to WCAG 1.3.1 (Info and Relationships).
 */

import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import type {
    NavigationStep,
    StrategyResult,
} from '../../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import { createScreenReaderContext } from '../../../utils/tool-details';
import type { ScreenReaderName } from '../../../../screen-reader/drivers/types';

const LANDMARK_ITEM_THRESHOLD_DEFAULT = 5;

export interface LandmarkWithoutHeadingStats {
    totalStepsAnalyzed: number;
    landmarksAnalyzed: number;
    violationsFound: number;
    threshold: number;
}

interface LandmarkContent {
    landmark: NavigationStep;
    stepIndex: number;
    contentSteps: NavigationStep[];
    hasHeading: boolean;
}

export class LandmarkWithoutHeadingRule implements Rule<ScreenReaderContext, LandmarkWithoutHeadingStats> {
    readonly id = 'landmark-without-heading';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
        },
        impact: 'moderate',
        summary: 'Landmark contains many items but no heading',
    };

    /** Minimum items in a landmark without a heading before flagging. */
    private readonly itemThreshold: number;

    constructor(itemThreshold = LANDMARK_ITEM_THRESHOLD_DEFAULT) {
        this.itemThreshold = itemThreshold;
    }

    async run(ctx: AuditContext): Promise<RuleResult<ScreenReaderContext, LandmarkWithoutHeadingStats>> {
        const { transcript } = ctx;
        const violations: ScreenReaderViolation[] = [];

        const arrowResult = this.getArrowStrategyResult(transcript);

        if (!arrowResult) {
            return {
                violations,
                stats: {
                    totalStepsAnalyzed: 0,
                    landmarksAnalyzed: 0,
                    violationsFound: 0,
                    threshold: this.itemThreshold,
                },
            };
        }

        const landmarks = this.findLandmarkBoundaries(arrowResult.navigationSteps);
        const flagged = landmarks.filter(
            (l) => l.contentSteps.length >= this.itemThreshold && !this.hasHeading(l.contentSteps)
        );

        for (const landmark of flagged) {
            violations.push(this.createViolation(landmark, ctx.screenReader));
        }

        return {
            violations,
            stats: {
                totalStepsAnalyzed: arrowResult.navigationSteps.length,
                landmarksAnalyzed: landmarks.length,
                violationsFound: violations.length,
                threshold: this.itemThreshold,
            },
        };
    }

    private getArrowStrategyResult(transcript: StrategyResult[]): StrategyResult | undefined {
        return transcript.find((r) => r.meta.name === 'arrow');
    }

    private findLandmarkBoundaries(steps: NavigationStep[]): LandmarkContent[] {
        const landmarks: LandmarkContent[] = [];
        let current: LandmarkContent | null = null;

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i]!;
            const spoken = step.spokenPhrases.join(' ').toLowerCase();

            if (spoken.includes('landmark')) {
                if (current) landmarks.push(current);
                current = {
                    landmark: step,
                    stepIndex: i,
                    contentSteps: [],
                    hasHeading: false,
                };
            } else if (current) {
                current.contentSteps.push(step);
            }
        }

        if (current) landmarks.push(current);
        return landmarks;
    }

    private hasHeading(steps: NavigationStep[]): boolean {
        return steps.some((step) => {
            const spoken = step.spokenPhrases.join(' ').toLowerCase();
            return spoken.includes('heading, level') || spoken.includes('heading level');
        });
    }

    private createViolation(landmark: LandmarkContent, screenReader: ScreenReaderName): ScreenReaderViolation {
        const landmarkSpoken = landmark.landmark.spokenPhrases.join(' ');

        return {
            id: `landmark-without-heading-${landmark.landmark.identifier}`,
            rule: {
                id: this.id,
                summary: this.meta.summary,
                wcag: this.meta.wcag,
                impact: this.meta.impact,
            },
            message: `Landmark "${landmarkSpoken}" contains ${landmark.contentSteps.length} items but no heading. Consider adding a heading to help screen reader users understand the section's purpose.`,
            ...(landmark.landmark.htmlSnippet != null
                ? { element: { htmlSnippet: landmark.landmark.htmlSnippet } }
                : {}),
            tool: 'screen-reader-audit',
            timestamp: landmark.landmark.timestamp,
            context: createScreenReaderContext(landmark.landmark, 'arrow', landmark.stepIndex, screenReader),
        };
    }
}

export const rule = new LandmarkWithoutHeadingRule();
