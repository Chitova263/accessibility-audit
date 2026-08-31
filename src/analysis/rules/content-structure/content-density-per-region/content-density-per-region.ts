import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { NvdaContext, NvdaViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { createNvdaContext } from '../../../utils/tool-details';
import { getRule } from '../../rule-catalog';
import type {
    NavigationStep,
    StrategyResult,
} from '../../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

export interface RegionDensity {
    landmark: string;
    startStep: number;
    endStep: number;
    itemCount: number;
    exceedsThreshold: boolean;
}

export interface ContentDensityPerRegionStats {
    regions: RegionDensity[];
    totalRegionsOverThreshold: number;
    threshold: number;
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
 * Analyzes content density within each landmark region.
 * Regions with too many items may overwhelm screen reader users.
 *
 * Oversized navigation regions are already reported by the navigation-size
 * analyzer, which counts links rather than steps. Recording the region in the
 * stats but skipping the violation for `navigation` keeps the two from
 * double-reporting.
 *
 * WCAG 2.4.1: Bypass Blocks (Level A)
 */
export class ContentDensityPerRegionRule implements Rule<NvdaContext, ContentDensityPerRegionStats> {
    readonly id = 'content-density-per-region';

    /** Default threshold: 50 items per region is excessive. */
    readonly threshold: number;

    constructor(options: { threshold?: number } = {}) {
        this.threshold = options.threshold ?? 50;
    }

    readonly meta: RuleMeta = {
        wcag: { primary: { criterion: '2.4.1', level: 'A' } },
        impact: 'moderate',
        summary: 'Landmark region contains an overwhelming number of items',
    };

    async run({ transcript }: AuditContext): Promise<RuleResult<NvdaContext, ContentDensityPerRegionStats>> {
        const violations: NvdaViolation[] = [];
        const regions: RegionDensity[] = [];
        const threshold = this.threshold;

        const arrowResult = getArrowStrategyResult(transcript);
        if (!arrowResult) {
            return {
                violations: [],
                stats: { regions: [], totalRegionsOverThreshold: 0, threshold },
            };
        }

        const steps = arrowResult.navigationSteps;

        const landmarkSteps: { landmark: string; stepIndex: number }[] = [];

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i]!;
            const spoken = getSpokenText(step);
            const role = getRole(step);

            for (const [landmark, pattern] of Object.entries(LANDMARK_PATTERNS)) {
                if (role === landmark || pattern.test(spoken)) {
                    landmarkSteps.push({ landmark, stepIndex: i });
                    break;
                }
            }
        }

        for (let i = 0; i < landmarkSteps.length; i++) {
            const current = landmarkSteps[i]!;
            const next = landmarkSteps[i + 1];

            const startStep = current.stepIndex;
            const endStep = next ? next.stepIndex - 1 : steps.length - 1;
            const itemCount = endStep - startStep;
            const exceedsThreshold = itemCount > threshold;

            regions.push({ landmark: current.landmark, startStep, endStep, itemCount, exceedsThreshold });

            if (exceedsThreshold && current.landmark !== 'navigation') {
                const step = steps[startStep]!;
                violations.push(
                    createViolation(
                        'content-density-per-region',
                        `${current.landmark} region contains ${itemCount} items (threshold: ${threshold}). This high density may overwhelm screen reader users. Consider breaking into smaller sections or adding sub-headings.`,
                        step,
                        arrowResult.meta.name
                    )
                );
            }
        }

        return {
            violations,
            stats: {
                regions,
                totalRegionsOverThreshold: regions.filter((r) => r.exceedsThreshold).length,
                threshold,
            },
        };
    }
}

export const rule = new ContentDensityPerRegionRule();
