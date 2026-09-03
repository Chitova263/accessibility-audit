/**
 * Rule: Large Content Gap
 *
 * Detects large sections of content within the main landmark that have no
 * heading, making it hard for screen reader users to orient themselves.
 *
 * Only analyzes content inside the main landmark region to avoid false
 * positives from navigation, header, and footer elements.
 *
 * Maps to WCAG 1.3.1 (Info and Relationships).
 */

import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import type { NavigationStep, StrategyResult } from '../../../../screen-reader/strategies/navigation-strategy';
import { buildViolation } from '../../rule-catalog';
import { createScreenReaderContext } from '../../../utils/tool-details';

const GAP_THRESHOLD_DEFAULT = 15;

export interface LargeContentGapStats {
    totalStepsAnalyzed: number;
    mainContentSteps: number;
    gapsFound: number;
    threshold: number;
}

interface ContentGap {
    startStep: NavigationStep;
    endStep: NavigationStep;
    stepCount: number;
    startStepIndex: number;
    endStepIndex: number;
    /** Original index in the full arrow navigation */
    originalStartIndex: number;
    originalEndIndex: number;
}

interface MainContentRegion {
    steps: NavigationStep[];
    startIndex: number;
    endIndex: number;
}

export class LargeContentGapRule implements Rule<ScreenReaderContext, LargeContentGapStats> {
    readonly id = 'large-content-gap';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
        },
        summary: 'Long run of main content with no heading between items',
    };

    private readonly threshold: number;

    constructor(threshold = GAP_THRESHOLD_DEFAULT) {
        this.threshold = threshold;
    }

    async run(ctx: AuditContext): Promise<RuleResult<ScreenReaderContext, LargeContentGapStats>> {
        const { transcript } = ctx;
        const violations: ScreenReaderViolation[] = [];

        const arrowResult = this.getArrowStrategyResult(transcript);

        if (!arrowResult) {
            return {
                violations,
                stats: { totalStepsAnalyzed: 0, mainContentSteps: 0, gapsFound: 0, threshold: this.threshold },
            };
        }

        const mainRegion = this.extractMainContentRegion(arrowResult.navigationSteps);

        if (!mainRegion || mainRegion.steps.length === 0) {
            return {
                violations,
                stats: {
                    totalStepsAnalyzed: arrowResult.navigationSteps.length,
                    mainContentSteps: 0,
                    gapsFound: 0,
                    threshold: this.threshold,
                },
            };
        }

        const gaps = this.findLargeContentGaps(mainRegion);

        for (const gap of gaps) {
            violations.push(
                buildViolation({
                    ruleId: 'large-content-gap',
                    impact: 'moderate',
                    stepId: `large-content-gap-${gap.startStep.identifier}`,
                    message: `Large content section (${gap.stepCount} items) within main content without a heading. Content between steps ${gap.originalStartIndex} and ${gap.originalEndIndex} may need a section heading for screen reader navigation. Threshold: ${this.threshold} items.`,
                    timestamp: gap.startStep.timestamp,
                    context: createScreenReaderContext(
                        gap.startStep,
                        'arrow',
                        gap.originalStartIndex,
                        ctx.screenReader
                    ),
                    htmlSnippet: gap.startStep.htmlSnippet,
                    screenReader: ctx.screenReader,
                })
            );
        }

        return {
            violations,
            stats: {
                totalStepsAnalyzed: arrowResult.navigationSteps.length,
                mainContentSteps: mainRegion.steps.length,
                gapsFound: gaps.length,
                threshold: this.threshold,
            },
        };
    }

    private getArrowStrategyResult(transcript: StrategyResult[]): StrategyResult | undefined {
        return transcript.find((r) => r.meta.name === 'arrow');
    }

    /**
     * Extract only the steps that fall within the main landmark region.
     * NVDA announces "main landmark" when entering and announces another
     * landmark (e.g., "content info landmark", "banner landmark") when leaving.
     */
    private extractMainContentRegion(steps: NavigationStep[]): MainContentRegion | null {
        let mainStartIndex = -1;
        let mainEndIndex = steps.length;

        for (let i = 0; i < steps.length; i++) {
            const spoken = steps[i]!.spokenPhrases.join(' ').toLowerCase();

            if (mainStartIndex === -1 && spoken.includes('main landmark')) {
                mainStartIndex = i;
                continue;
            }

            // Once we're in main, look for exit into another landmark
            if (mainStartIndex !== -1 && this.isLandmarkAnnouncement(spoken) && !spoken.includes('main landmark')) {
                mainEndIndex = i;
                break;
            }
        }

        if (mainStartIndex === -1) {
            return null;
        }

        return {
            steps: steps.slice(mainStartIndex, mainEndIndex),
            startIndex: mainStartIndex,
            endIndex: mainEndIndex,
        };
    }

    /**
     * Check if a spoken phrase indicates entering a landmark region.
     * NVDA announces landmarks as "[name] landmark" when entering.
     */
    private isLandmarkAnnouncement(spoken: string): boolean {
        return (
            spoken.includes('main landmark') ||
            spoken.includes('banner landmark') ||
            spoken.includes('navigation landmark') ||
            spoken.includes('content info landmark') ||
            spoken.includes('contentinfo landmark') ||
            spoken.includes('complementary landmark') ||
            spoken.includes('search landmark') ||
            spoken.includes('region landmark') ||
            spoken.includes('form landmark')
        );
    }

    private findLargeContentGaps(mainRegion: MainContentRegion): ContentGap[] {
        const gaps: ContentGap[] = [];
        const steps = mainRegion.steps;
        const headingIndices = this.findHeadingIndices(steps);

        if (headingIndices.length === 0) {
            if (steps.length >= this.threshold) {
                gaps.push({
                    startStep: steps[0]!,
                    endStep: steps[steps.length - 1]!,
                    stepCount: steps.length,
                    startStepIndex: 0,
                    endStepIndex: steps.length - 1,
                    originalStartIndex: mainRegion.startIndex,
                    originalEndIndex: mainRegion.startIndex + steps.length - 1,
                });
            }
            return gaps;
        }

        // Check gap before first heading (within main)
        if (headingIndices[0]! >= this.threshold) {
            gaps.push({
                startStep: steps[0]!,
                endStep: steps[headingIndices[0]! - 1]!,
                stepCount: headingIndices[0]!,
                startStepIndex: 0,
                endStepIndex: headingIndices[0]! - 1,
                originalStartIndex: mainRegion.startIndex,
                originalEndIndex: mainRegion.startIndex + headingIndices[0]! - 1,
            });
        }

        // Check gaps between headings
        for (let i = 0; i < headingIndices.length - 1; i++) {
            const gapSize = headingIndices[i + 1]! - headingIndices[i]! - 1;
            if (gapSize >= this.threshold) {
                const startIdx = headingIndices[i]! + 1;
                const endIdx = headingIndices[i + 1]! - 1;
                gaps.push({
                    startStep: steps[startIdx]!,
                    endStep: steps[endIdx]!,
                    stepCount: gapSize,
                    startStepIndex: startIdx,
                    endStepIndex: endIdx,
                    originalStartIndex: mainRegion.startIndex + startIdx,
                    originalEndIndex: mainRegion.startIndex + endIdx,
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
}

export const rule = new LargeContentGapRule();
