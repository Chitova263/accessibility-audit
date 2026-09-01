/**
 * Rule: Repeated Pattern Without Heading
 *
 * Detects runs of structurally similar content (e.g., many consecutive
 * clickable items, buttons, or links) that have no preceding section heading,
 * making it hard for screen reader users to understand what the group represents.
 *
 * Maps to WCAG 1.3.1 (Info and Relationships).
 */

import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { NvdaContext, NvdaViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import type {
    NavigationStep,
    StrategyResult,
} from '../../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import { createNvdaContext } from '../../../utils/tool-details';

const REPETITION_THRESHOLD_DEFAULT = 3;

/** How far back (in steps) to look for a preceding heading. */
const HEADING_LOOKBACK = 5;

export interface RepeatedPatternWithoutHeadingStats {
    totalStepsAnalyzed: number;
    patternsFound: number;
    violationsFound: number;
    threshold: number;
}

interface RepeatedPattern {
    pattern: string;
    occurrences: NavigationStep[];
    startIndex: number;
}

export class RepeatedPatternWithoutHeadingRule implements Rule<NvdaContext, RepeatedPatternWithoutHeadingStats> {
    readonly id = 'repeated-pattern-without-heading';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
        },
        impact: 'minor',
        summary: 'Repeated content pattern with no heading introducing the group',
    };

    /** Minimum consecutive repetitions of the same structural role before flagging. */
    private readonly repetitionThreshold: number;

    constructor(repetitionThreshold = REPETITION_THRESHOLD_DEFAULT) {
        this.repetitionThreshold = repetitionThreshold;
    }

    async run(ctx: AuditContext): Promise<RuleResult<NvdaContext, RepeatedPatternWithoutHeadingStats>> {
        const { transcript } = ctx;
        const violations: NvdaViolation[] = [];

        const arrowResult = this.getArrowStrategyResult(transcript);

        if (!arrowResult) {
            return {
                violations,
                stats: {
                    totalStepsAnalyzed: 0,
                    patternsFound: 0,
                    violationsFound: 0,
                    threshold: this.repetitionThreshold,
                },
            };
        }

        const allPatterns = this.findStructuralPatterns(arrowResult.navigationSteps);
        const flagged = allPatterns.filter((p) => !this.hasHeadingBefore(arrowResult.navigationSteps, p.startIndex));

        for (const pattern of flagged) {
            violations.push(this.createViolation(pattern));
        }

        return {
            violations,
            stats: {
                totalStepsAnalyzed: arrowResult.navigationSteps.length,
                patternsFound: allPatterns.length,
                violationsFound: violations.length,
                threshold: this.repetitionThreshold,
            },
        };
    }

    private getArrowStrategyResult(transcript: StrategyResult[]): StrategyResult | undefined {
        return transcript.find((r) => r.meta.name === 'arrow');
    }

    private findStructuralPatterns(steps: NavigationStep[]): RepeatedPattern[] {
        const patterns: RepeatedPattern[] = [];

        const roleSequences: { role: string; step: NavigationStep; index: number }[] = [];
        for (let i = 0; i < steps.length; i++) {
            const spoken = steps[i]!.spokenPhrases.join(' ').toLowerCase();
            const role = this.extractStructuralRole(spoken);
            if (role) {
                roleSequences.push({ role, step: steps[i]!, index: i });
            }
        }

        const targetRoles = ['clickable'] as const;
        for (const targetRole of targetRoles) {
            const groups = this.findConsecutiveGroups(roleSequences, targetRole, this.repetitionThreshold);
            for (const group of groups) {
                patterns.push({
                    pattern: 'clickable items',
                    occurrences: group.map((g) => g.step),
                    startIndex: group[0]!.index,
                });
            }
        }

        return patterns;
    }

    private extractStructuralRole(spoken: string): string | null {
        if (spoken.includes('clickable')) return 'clickable';
        if (spoken.includes('button')) return 'button';
        if (spoken.includes('link')) return 'link';
        if (spoken.includes('graphic')) return 'graphic';
        return null;
    }

    private findConsecutiveGroups<T extends { role: string }>(items: T[], targetRole: string, minSize: number): T[][] {
        const groups: T[][] = [];
        let current: T[] = [];

        for (const item of items) {
            if (item.role === targetRole) {
                current.push(item);
            } else {
                if (current.length >= minSize) groups.push(current);
                current = [];
            }
        }

        if (current.length >= minSize) groups.push(current);
        return groups;
    }

    private hasHeadingBefore(steps: NavigationStep[], beforeIndex: number): boolean {
        const lookback = Math.min(beforeIndex, HEADING_LOOKBACK);
        for (let i = beforeIndex - 1; i >= beforeIndex - lookback; i--) {
            const step = steps[i];
            if (!step) continue;
            const spoken = step.spokenPhrases.join(' ').toLowerCase();
            if (spoken.includes('heading, level') || spoken.includes('heading level')) {
                return true;
            }
        }
        return false;
    }

    private createViolation(pattern: RepeatedPattern): NvdaViolation {
        const first = pattern.occurrences[0]!;

        return {
            id: `repeated-pattern-${first.identifier}`,
            rule: {
                id: this.id,
                summary: this.meta.summary,
                wcag: this.meta.wcag,
                impact: this.meta.impact,
            },
            message: `Repeated content pattern detected: ${pattern.occurrences.length} similar "${pattern.pattern}" without a preceding section heading. Consider adding a heading to group this content (e.g., "Products", "Results", "Items").`,
            ...(first.htmlSnippet != null ? { element: { htmlSnippet: first.htmlSnippet } } : {}),
            tool: 'nvda-audit',
            timestamp: first.timestamp,
            context: createNvdaContext(first, 'arrow', pattern.startIndex),
        };
    }
}

export const rule = new RepeatedPatternWithoutHeadingRule();
