import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { createScreenReaderContext } from '../../../utils/tool-details';
import { getRule } from '../../rule-catalog';
import type { ScreenReaderName } from '../../../../screen-reader/drivers/types';
import type {
    NavigationStep,
    StrategyResult,
} from '../../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import { getRole as getAxRole } from '../../../../types/ax-utils';

export interface StepsToMainContentStats {
    stepsToMain: number | null;
    mainFoundAtStep: number | null;
    mainFound: boolean;
    totalSteps: number;
    threshold: number;
    exceedsThreshold: boolean;
}

function getArrowStrategyResult(transcript: StrategyResult[]): StrategyResult | undefined {
    return transcript.find((r) => r.meta.name === 'arrow');
}

function getSpokenText(step: NavigationStep): string {
    return step.spokenPhrases.join(' ').toLowerCase().trim();
}

function getRole(step: NavigationStep): string | undefined {
    return step.axNode ? getAxRole(step.axNode) : undefined;
}

function createViolation(
    ruleId: Parameters<typeof getRule>[0],
    message: string,
    step: NavigationStep,
    strategyName: string,
    screenReader: ScreenReaderName,
    impactOverride?: Parameters<typeof getRule>[1]
): ScreenReaderViolation {
    return {
        id: `${ruleId}-${step.identifier}`,
        rule: getRule(ruleId, impactOverride),
        message,
        ...(step.htmlSnippet != null ? { element: { htmlSnippet: step.htmlSnippet } } : {}),
        tool: 'screen-reader-audit',
        timestamp: step.timestamp,
        context: createScreenReaderContext(step, strategyName, step.index, screenReader),
    };
}

/**
 * Analyzes how many steps it takes to reach the main content landmark.
 * Excessive steps before main content indicate poor bypass block implementation.
 *
 * WCAG 2.4.1: Bypass Blocks (Level A)
 */
export class StepsToMainContentRule implements Rule<ScreenReaderContext, StepsToMainContentStats> {
    readonly id = 'steps-to-main-content';

    /** Default threshold: 30 steps before main landmark is too many. */
    readonly threshold: number;

    constructor(options: { threshold?: number } = {}) {
        this.threshold = options.threshold ?? 30;
    }

    readonly meta: RuleMeta = {
        wcag: { primary: { criterion: '2.4.1', level: 'A' } },
        impact: 'moderate',
        summary: 'Main content reached only after excessive linear reading steps',
    };

    async run({
        transcript,
        screenReader,
    }: AuditContext): Promise<RuleResult<ScreenReaderContext, StepsToMainContentStats>> {
        const violations: ScreenReaderViolation[] = [];
        const threshold = this.threshold;

        const arrowResult = getArrowStrategyResult(transcript);
        if (!arrowResult) {
            return {
                violations: [],
                stats: {
                    stepsToMain: null,
                    mainFoundAtStep: null,
                    mainFound: false,
                    totalSteps: 0,
                    threshold,
                    exceedsThreshold: false,
                },
            };
        }

        const steps = arrowResult.navigationSteps;
        let mainFoundAtStep: number | null = null;

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i]!;
            const spoken = getSpokenText(step);
            const role = getRole(step);

            if (role === 'main' || spoken.includes('main landmark') || spoken.includes('main region')) {
                mainFoundAtStep = i;
                break;
            }
        }

        const stepsToMain = mainFoundAtStep !== null ? mainFoundAtStep : null;
        const exceedsThreshold = stepsToMain !== null && stepsToMain > threshold;

        if (exceedsThreshold && mainFoundAtStep !== null) {
            const step = steps[mainFoundAtStep]!;
            violations.push(
                createViolation(
                    'steps-to-main-content',
                    `Main content reached after ${stepsToMain} steps (threshold: ${threshold}). Users must navigate through excessive content before reaching main content. Consider adding or improving skip links.`,
                    step,
                    arrowResult.meta.name,
                    screenReader
                )
            );
        }

        // Never reaching a main landmark is worse than reaching it late: there is no
        // target for skip links and no way to bypass repeated content at all.
        if (mainFoundAtStep === null && steps.length > 0) {
            violations.push(
                createViolation(
                    'missing-main-landmark',
                    `No main landmark was announced across ${steps.length} steps of linear reading. Without a main landmark, screen reader users cannot jump past repeated header and navigation content. Wrap the primary content in a <main> element.`,
                    steps[0]!,
                    arrowResult.meta.name,
                    screenReader
                )
            );
        }

        return {
            violations,
            stats: {
                stepsToMain,
                mainFoundAtStep,
                mainFound: mainFoundAtStep !== null,
                totalSteps: steps.length,
                threshold,
                exceedsThreshold,
            },
        };
    }
}

export const rule = new StepsToMainContentRule();
