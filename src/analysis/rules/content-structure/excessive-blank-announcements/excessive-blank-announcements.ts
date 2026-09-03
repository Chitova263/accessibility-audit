import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { buildViolation } from '../../rule-catalog';
import { createScreenReaderContext } from '../../../utils/tool-details';
import type { StrategyResult } from '../../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

export interface BlankRun {
    startStep: number;
    endStep: number;
    count: number;
    beforeContext: string | null;
    afterContext: string | null;
}

export interface ExcessiveBlankAnnouncementsStats {
    blankRuns: BlankRun[];
    totalBlankRuns: number;
    threshold: number;
}

function getArrowStrategyResult(transcript: StrategyResult[]): StrategyResult | undefined {
    return transcript.find((r) => r.meta.name === 'arrow');
}

function isBlank(focusedElementText: string): boolean {
    const normalized = focusedElementText.toLowerCase().trim();
    return normalized === 'blank' || normalized.endsWith(', blank') || normalized.endsWith(' blank');
}

/**
 * Detects long runs of consecutive "blank" announcements in arrow navigation.
 * Excessive blanks indicate empty or improperly structured content that wastes
 * screen reader users' time and causes confusion.
 *
 * WCAG 1.3.1: Info and Relationships (Level A)
 */
export class ExcessiveBlankAnnouncementsRule implements Rule<ScreenReaderContext, ExcessiveBlankAnnouncementsStats> {
    readonly id = 'excessive-blank-announcements';
    readonly threshold: number;

    constructor(options: { threshold?: number } = {}) {
        this.threshold = options.threshold ?? 5;
    }

    readonly meta: RuleMeta = {
        wcag: { primary: { criterion: '1.3.1', level: 'A' } },
        summary: 'Long run of blank announcements in linear reading',
    };

    async run({
        transcript,
        screenReader,
    }: AuditContext): Promise<RuleResult<ScreenReaderContext, ExcessiveBlankAnnouncementsStats>> {
        const { threshold } = this;
        const blankRuns: BlankRun[] = [];

        const arrowResult = getArrowStrategyResult(transcript);
        if (!arrowResult) {
            return {
                violations: [],
                stats: { blankRuns: [], totalBlankRuns: 0, threshold },
            };
        }

        const steps = arrowResult.navigationSteps;
        let runStart: number | null = null;
        let runCount = 0;

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i]!;

            if (isBlank(step.focusedElementText)) {
                if (runStart === null) {
                    runStart = i;
                    runCount = 1;
                } else {
                    runCount++;
                }
            } else {
                if (runStart !== null && runCount >= threshold) {
                    blankRuns.push({
                        startStep: runStart,
                        endStep: i - 1,
                        count: runCount,
                        beforeContext: runStart > 0 ? steps[runStart - 1]!.focusedElementText : null,
                        afterContext: steps[i]!.focusedElementText,
                    });
                }
                runStart = null;
                runCount = 0;
            }
        }

        if (runStart !== null && runCount >= threshold) {
            blankRuns.push({
                startStep: runStart,
                endStep: steps.length - 1,
                count: runCount,
                beforeContext: runStart > 0 ? steps[runStart - 1]!.focusedElementText : null,
                afterContext: null,
            });
        }

        const violations: ScreenReaderViolation[] = blankRuns.map((run) => {
            const step = steps[run.startStep]!;
            const contextParts: string[] = [];
            if (run.beforeContext) contextParts.push(`after "${run.beforeContext}"`);
            if (run.afterContext) contextParts.push(`before "${run.afterContext}"`);
            const contextStr = contextParts.length > 0 ? ` (${contextParts.join(', ')})` : '';

            return buildViolation({
                ruleId: 'excessive-blank-announcements',
                impact: 'moderate',
                stepId: `excessive-blank-announcements-${step.identifier}`,
                message:
                    `${run.count} consecutive blank announcements at steps ${run.startStep}-${run.endStep}${contextStr}. ` +
                    'This indicates empty or improperly structured content that wastes time for screen reader users.',
                timestamp: step.timestamp,
                context: createScreenReaderContext(step, arrowResult.meta.name, step.index, screenReader),
                screenReader,
            });
        });

        return {
            violations,
            stats: {
                blankRuns,
                totalBlankRuns: blankRuns.length,
                threshold,
            },
        };
    }
}

export const rule = new ExcessiveBlankAnnouncementsRule();
