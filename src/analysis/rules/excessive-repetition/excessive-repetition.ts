import type { Rule, RuleMeta, RuleResult } from '../../core/rule';
import type { NvdaContext, NvdaViolation } from '../../core/violation';
import type { AuditContext } from '../../core/context';
import { createNvdaContext } from '../../utils/tool-details';
import { getRule } from '../rule-catalog';
import type {
    NavigationStep,
    StrategyResult,
} from '../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

export interface RepetitionInfo {
    phrase: string;
    count: number;
    startStep: number;
    endStep: number;
}

export interface ExcessiveRepetitionStats {
    repetitions: RepetitionInfo[];
    totalExcessiveRepetitions: number;
    threshold: number;
}

function getArrowStrategyResult(transcript: StrategyResult[]): StrategyResult | undefined {
    return transcript.find((r) => r.meta.type === 'arrow' || r.meta.name === 'ArrowNavigation');
}

function createViolation(
    ruleId: Parameters<typeof getRule>[0],
    message: string,
    step: NavigationStep,
    strategyName: string,
    impactOverride?: Parameters<typeof getRule>[1]
): NvdaViolation {
    return {
        id: `${ruleId}-${step.identifier}`,
        rule: getRule(ruleId, impactOverride),
        message,
        ...(step.htmlSnippet != null ? { element: { htmlSnippet: step.htmlSnippet } } : {}),
        tool: 'nvda-audit',
        timestamp: step.timestamp,
        context: createNvdaContext(step, strategyName, step.index),
    };
}

/**
 * Analyzes for phrases that are announced repeatedly in sequence.
 * Excessive repetition indicates poor accessible naming or redundant content.
 *
 * WCAG 1.3.1: Info and Relationships (Level A)
 */
export class ExcessiveRepetitionRule implements Rule<NvdaContext, ExcessiveRepetitionStats> {
    readonly id = 'excessive-repetition';

    /**
     * Default threshold: 5+ repetitions rather than 3+.
     * A linear arrow walk crosses product grids and card lists where 3 identical
     * announcements in a row are normal rather than a defect.
     */
    readonly threshold: number;

    /** Minimum phrase length to consider; very short phrases are ignored. */
    readonly minPhraseLength: number;

    constructor(options: { threshold?: number; minPhraseLength?: number } = {}) {
        this.threshold = options.threshold ?? 5;
        this.minPhraseLength = options.minPhraseLength ?? 3;
    }

    readonly meta: RuleMeta = {
        wcag: { primary: { criterion: '1.3.1', level: 'A' } },
        impact: 'minor',
        summary: 'Same phrase announced many times consecutively',
    };

    async run({ transcript }: AuditContext): Promise<RuleResult<NvdaContext, ExcessiveRepetitionStats>> {
        const violations: NvdaViolation[] = [];
        const repetitions: RepetitionInfo[] = [];
        const { threshold, minPhraseLength } = this;

        const arrowResult = getArrowStrategyResult(transcript);
        if (!arrowResult) {
            return {
                violations: [],
                stats: { repetitions: [], totalExcessiveRepetitions: 0, threshold },
            };
        }

        const steps = arrowResult.navigationSteps;

        let currentPhrase = '';
        let count = 0;
        let startStep = 0;

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i]!;
            const phrase = step.itemText.toLowerCase().trim();

            if (phrase.length < minPhraseLength) {
                if (count >= threshold) {
                    repetitions.push({ phrase: currentPhrase, count, startStep, endStep: i - 1 });
                }
                currentPhrase = '';
                count = 0;
                continue;
            }

            if (phrase === currentPhrase) {
                count++;
            } else {
                if (count >= threshold) {
                    repetitions.push({ phrase: currentPhrase, count, startStep, endStep: i - 1 });
                }
                currentPhrase = phrase;
                count = 1;
                startStep = i;
            }
        }

        if (count >= threshold) {
            repetitions.push({
                phrase: currentPhrase,
                count,
                startStep,
                endStep: steps.length - 1,
            });
        }

        for (const rep of repetitions) {
            const step = steps[rep.startStep]!;
            violations.push(
                createViolation(
                    'excessive-repetition',
                    `"${rep.phrase}" is announced ${rep.count} times consecutively (steps ${rep.startStep}-${rep.endStep}). This repetition may confuse screen reader users or indicate redundant content.`,
                    step,
                    arrowResult.meta.name
                )
            );
        }

        return {
            violations,
            stats: {
                repetitions,
                totalExcessiveRepetitions: repetitions.length,
                threshold,
            },
        };
    }
}

export const rule = new ExcessiveRepetitionRule();
