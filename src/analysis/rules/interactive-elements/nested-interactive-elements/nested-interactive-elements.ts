import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { buildViolation } from '../../rule-catalog';
import { createScreenReaderContext } from '../../../utils/tool-details';
import type {
    NavigationStep,
    StrategyResult,
} from '../../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

export interface NestedPattern {
    step: number;
    pattern: string;
    focusedElementText: string;
}

export interface NestedInteractiveElementsStats {
    patterns: NestedPattern[];
    totalPatterns: number;
}

// Patterns that indicate nested interactive elements
const NESTED_PATTERNS = [
    /link,\s*link/i, // "link, link" - nested links
    /button,\s*link/i, // "button, link" - button containing link
    /link,\s*button/i, // "link, button" - link containing button
    /button,\s*button/i, // "button, button" - nested buttons
];

function getArrowStrategyResult(transcript: StrategyResult[]): StrategyResult | undefined {
    return transcript.find((r) => r.meta.name === 'arrow');
}

function getLinkStrategyResult(transcript: StrategyResult[]): StrategyResult | undefined {
    return transcript.find((r) => r.meta.name === 'link');
}

function detectNestedPattern(focusedElementText: string): string | null {
    for (const pattern of NESTED_PATTERNS) {
        if (pattern.test(focusedElementText)) {
            const match = focusedElementText.match(pattern);
            return match ? match[0] : null;
        }
    }
    return null;
}

/**
 * Detects nested interactive elements (links within links, buttons within links, etc.).
 * These create confusing announcements like "link, link" and violate HTML nesting rules.
 * Screen reader users may not understand which element they're activating.
 *
 * WCAG 4.1.1: Parsing (Level A) - proper nesting of interactive elements
 */
export class NestedInteractiveElementsRule implements Rule<ScreenReaderContext, NestedInteractiveElementsStats> {
    readonly id = 'nested-interactive-elements';

    readonly meta: RuleMeta = {
        wcag: { primary: { criterion: '4.1.1', level: 'A' } },
        summary: 'Interactive elements are improperly nested',
    };

    async run({
        transcript,
        screenReader,
    }: AuditContext): Promise<RuleResult<ScreenReaderContext, NestedInteractiveElementsStats>> {
        const patterns: NestedPattern[] = [];
        const seen = new Set<string>();

        // Check arrow navigation for nested patterns
        const arrowResult = getArrowStrategyResult(transcript);
        if (arrowResult) {
            this.analyzeSteps(arrowResult.navigationSteps, patterns, seen);
        }

        // Also check link navigation
        const linkResult = getLinkStrategyResult(transcript);
        if (linkResult) {
            this.analyzeSteps(linkResult.navigationSteps, patterns, seen);
        }

        const sourceResult = arrowResult ?? linkResult;

        const violations: ScreenReaderViolation[] = patterns.map((p) => {
            const step = sourceResult!.navigationSteps[p.step]!;
            return buildViolation({
                ruleId: 'nested-interactive-elements',
                impact: 'serious',
                stepId: `nested-interactive-elements-${step.identifier}`,
                message:
                    `Nested interactive elements detected: "${p.pattern}". ` +
                    `The announcement "${p.focusedElementText.substring(0, 100)}${p.focusedElementText.length > 100 ? '...' : ''}" ` +
                    'indicates improperly nested links or buttons, which confuses screen reader users.',
                timestamp: step.timestamp,
                context: createScreenReaderContext(step, sourceResult!.meta.name, step.index, screenReader),
                htmlSnippet: step.htmlSnippet,
                screenReader,
            });
        });

        return {
            violations,
            stats: {
                patterns,
                totalPatterns: patterns.length,
            },
        };
    }

    private analyzeSteps(steps: NavigationStep[], patterns: NestedPattern[], seen: Set<string>): void {
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i]!;
            const pattern = detectNestedPattern(step.focusedElementText);

            if (pattern) {
                // Dedupe by pattern + truncated text
                const key = `${pattern}:${step.focusedElementText.substring(0, 50)}`;
                if (seen.has(key)) continue;
                seen.add(key);

                patterns.push({
                    step: i,
                    pattern,
                    focusedElementText: step.focusedElementText,
                });
            }
        }
    }
}

export const rule = new NestedInteractiveElementsRule();
