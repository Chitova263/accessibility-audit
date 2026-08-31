import type { Rule, RuleMeta, RuleResult } from '../../core/rule';
import type { NvdaContext, NvdaViolation } from '../../core/violation';
import type { AuditContext } from '../../core/context';
import { createNvdaContext } from '../../utils/tool-details';
import { getRule } from '../rule-catalog';
import type {
    NavigationStep,
    StrategyResult,
} from '../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

export interface LandmarkSequenceInfo {
    landmark: string;
    stepIndex: number;
    spokenPhrase: string;
}

export interface ReadingOrderLandmarkSequenceStats {
    landmarkSequence: LandmarkSequenceInfo[];
    hasMainBeforeFooter: boolean;
    hasMainBeforeAside: boolean;
    violations: string[];
}

/**
 * Landmark announcements as NVDA speaks them, e.g. "banner landmark".
 *
 * The "landmark"/"region" qualifier is required: without it these patterns
 * collapse to bare word matches and fire on ordinary content ("domain" matching
 * main, "beside" matching aside), which corrupts every landmark boundary.
 *
 * Keys must be valid ARIA roles — they are also compared against the AX node
 * role, which is the more reliable of the two signals.
 */
const LANDMARK_PATTERNS: Record<string, RegExp> = {
    banner: /\bbanner\s+(landmark|region)\b/i,
    navigation: /\bnavigation\s+(landmark|region)\b/i,
    main: /\bmain\s+(landmark|region)\b/i,
    complementary: /\b(complementary|aside)\s+(landmark|region)\b/i,
    contentinfo: /\b(content\s*info|footer)\s+(landmark|region)\b/i,
};

function getArrowStrategyResult(transcript: StrategyResult[]): StrategyResult | undefined {
    return transcript.find((r) => r.meta.type === 'arrow' || r.meta.name === 'ArrowNavigation');
}

function getSpokenText(step: NavigationStep): string {
    return step.spokenPhrases.join(' ').toLowerCase().trim();
}

function getRole(step: NavigationStep): string | undefined {
    return (step.axNode?.role as any)?.value;
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
 * Analyzes if landmarks appear in a logical reading order.
 * Footer/aside appearing before main content indicates DOM order issues.
 *
 * WCAG 1.3.2: Meaningful Sequence (Level A)
 */
export class ReadingOrderLandmarkSequenceRule implements Rule<NvdaContext, ReadingOrderLandmarkSequenceStats> {
    readonly id = 'reading-order-landmark-sequence';

    readonly meta: RuleMeta = {
        wcag: { primary: { criterion: '1.3.2', level: 'A' } },
        impact: 'serious',
        summary: 'Landmarks announced out of logical reading order',
    };

    async run({ transcript }: AuditContext): Promise<RuleResult<NvdaContext, ReadingOrderLandmarkSequenceStats>> {
        const violations: NvdaViolation[] = [];
        const landmarkSequence: LandmarkSequenceInfo[] = [];

        const arrowResult = getArrowStrategyResult(transcript);
        if (!arrowResult) {
            return {
                violations: [],
                stats: {
                    landmarkSequence: [],
                    hasMainBeforeFooter: true,
                    hasMainBeforeAside: true,
                    violations: [],
                },
            };
        }

        const steps = arrowResult.navigationSteps;

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i]!;
            const spoken = getSpokenText(step);
            const role = getRole(step);

            for (const [landmark, pattern] of Object.entries(LANDMARK_PATTERNS)) {
                if (role === landmark || pattern.test(spoken)) {
                    landmarkSequence.push({
                        landmark,
                        stepIndex: i,
                        spokenPhrase: step.spokenPhrases.join(' '),
                    });
                    break;
                }
            }
        }

        const mainIndex = landmarkSequence.findIndex((l) => l.landmark === 'main');
        const footerIndex = landmarkSequence.findIndex((l) => l.landmark === 'contentinfo');
        const asideIndex = landmarkSequence.findIndex((l) => l.landmark === 'complementary');

        const hasMainBeforeFooter = mainIndex === -1 || footerIndex === -1 || mainIndex < footerIndex;
        const hasMainBeforeAside = mainIndex === -1 || asideIndex === -1 || mainIndex < asideIndex;

        const violationMessages: string[] = [];

        if (!hasMainBeforeFooter && footerIndex !== -1 && mainIndex !== -1) {
            const footerStep = steps[landmarkSequence[footerIndex]!.stepIndex]!;
            violations.push(
                createViolation(
                    'reading-order-landmark-sequence',
                    `Footer/contentinfo landmark (step ${landmarkSequence[footerIndex]!.stepIndex}) appears before main landmark (step ${landmarkSequence[mainIndex]!.stepIndex}). Screen reader users will hear footer content before main content.`,
                    footerStep,
                    arrowResult.meta.name
                )
            );
            violationMessages.push('Footer before main');
        }

        if (!hasMainBeforeAside && asideIndex !== -1 && mainIndex !== -1) {
            const asideStep = steps[landmarkSequence[asideIndex]!.stepIndex]!;
            violations.push(
                createViolation(
                    'reading-order-landmark-sequence',
                    `Complementary/aside landmark (step ${landmarkSequence[asideIndex]!.stepIndex}) appears before main landmark (step ${landmarkSequence[mainIndex]!.stepIndex}). Consider if sidebar content should come after main content.`,
                    asideStep,
                    arrowResult.meta.name,
                    'moderate'
                )
            );
            violationMessages.push('Aside before main');
        }

        return {
            violations,
            stats: {
                landmarkSequence,
                hasMainBeforeFooter,
                hasMainBeforeAside,
                violations: violationMessages,
            },
        };
    }
}

export const rule = new ReadingOrderLandmarkSequenceRule();
