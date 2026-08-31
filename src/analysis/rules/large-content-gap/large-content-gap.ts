/**
 * Rule: Large Content Gap
 *
 * Detects large sections of content in linear (arrow-key) navigation that have
 * no heading, making it hard for screen reader users to orient themselves.
 *
 * Maps to WCAG 1.3.1 (Info and Relationships).
 */

import type { Rule, RuleMeta, RuleResult } from '../../core/rule';
import type { NvdaContext, NvdaViolation } from '../../core/violation';
import type { AuditContext } from '../../core/context';
import type {
    NavigationStep,
    StrategyResult,
} from '../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import { createNvdaContext } from '../../utils/tool-details';

const GAP_THRESHOLD_DEFAULT = 15;

export interface LargeContentGapStats {
    totalStepsAnalyzed: number;
    gapsFound: number;
    threshold: number;
}

interface ContentGap {
    startStep: NavigationStep;
    endStep: NavigationStep;
    stepCount: number;
    startStepIndex: number;
    endStepIndex: number;
}

export class LargeContentGapRule implements Rule<NvdaContext, LargeContentGapStats> {
    readonly id = 'large-content-gap';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
        },
        impact: 'moderate',
        summary: 'Long run of content with no heading between items',
    };

    /** Minimum steps between headings to flag as a gap. */
    private readonly threshold: number;

    constructor(threshold = GAP_THRESHOLD_DEFAULT) {
        this.threshold = threshold;
    }

    async run(ctx: AuditContext): Promise<RuleResult<NvdaContext, LargeContentGapStats>> {
        const { transcript } = ctx;
        const violations: NvdaViolation[] = [];

        const arrowResult = this.getArrowStrategyResult(transcript);

        if (!arrowResult) {
            return {
                violations,
                stats: { totalStepsAnalyzed: 0, gapsFound: 0, threshold: this.threshold },
            };
        }

        const gaps = this.findLargeContentGaps(arrowResult);

        for (const gap of gaps) {
            violations.push(this.createViolation(gap));
        }

        return {
            violations,
            stats: {
                totalStepsAnalyzed: arrowResult.navigationSteps.length,
                gapsFound: gaps.length,
                threshold: this.threshold,
            },
        };
    }

    private getArrowStrategyResult(transcript: StrategyResult[]): StrategyResult | undefined {
        return transcript.find((r) => r.meta.type === 'arrow' || r.meta.name === 'ArrowNavigation');
    }

    private findLargeContentGaps(arrowResult: StrategyResult): ContentGap[] {
        const gaps: ContentGap[] = [];
        const steps = arrowResult.navigationSteps;
        const headingIndices = this.findHeadingIndices(steps);

        if (headingIndices.length === 0) {
            if (steps.length >= this.threshold) {
                gaps.push({
                    startStep: steps[0]!,
                    endStep: steps[steps.length - 1]!,
                    stepCount: steps.length,
                    startStepIndex: 0,
                    endStepIndex: steps.length - 1,
                });
            }
            return gaps;
        }

        if (headingIndices[0]! >= this.threshold) {
            gaps.push({
                startStep: steps[0]!,
                endStep: steps[headingIndices[0]! - 1]!,
                stepCount: headingIndices[0]!,
                startStepIndex: 0,
                endStepIndex: headingIndices[0]! - 1,
            });
        }

        for (let i = 0; i < headingIndices.length - 1; i++) {
            const gapSize = headingIndices[i + 1]! - headingIndices[i]! - 1;
            if (gapSize >= this.threshold) {
                gaps.push({
                    startStep: steps[headingIndices[i]! + 1]!,
                    endStep: steps[headingIndices[i + 1]! - 1]!,
                    stepCount: gapSize,
                    startStepIndex: headingIndices[i]! + 1,
                    endStepIndex: headingIndices[i + 1]! - 1,
                });
            }
        }

        return gaps;
    }

    private findHeadingIndices(steps: NavigationStep[]): number[] {
        const indices: number[] = [];
        for (let i = 0; i < steps.length; i++) {
            const spoken = steps[i]!.spokenPhrases.join(' ').toLowerCase();
            if (spoken.includes('heading, level') || spoken.includes('heading level')) {
                indices.push(i);
            }
        }
        return indices;
    }

    private createViolation(gap: ContentGap): NvdaViolation {
        return {
            id: `large-content-gap-${gap.startStep.identifier}`,
            rule: {
                id: this.id,
                summary: this.meta.summary,
                wcag: this.meta.wcag,
                impact: this.meta.impact,
            },
            message: `Large content section (${gap.stepCount} items) without a heading. Content between steps ${gap.startStepIndex} and ${gap.endStepIndex} may need a section heading for screen reader navigation. Threshold: ${this.threshold} items.`,
            ...(gap.startStep.htmlSnippet != null ? { element: { htmlSnippet: gap.startStep.htmlSnippet } } : {}),
            tool: 'nvda-audit',
            timestamp: gap.startStep.timestamp,
            context: createNvdaContext(gap.startStep, 'ArrowNavigation', gap.startStepIndex),
        };
    }
}

export const rule = new LargeContentGapRule();
