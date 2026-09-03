/**
 * Rule: aria-hidden on Focusable
 *
 * Detects elements with aria-hidden="true" that received keyboard focus.
 * This creates a confusing experience where focus lands on an element
 * but the screen reader announces nothing.
 *
 * Maps to WCAG 4.1.2 (Name, Role, Value) and 1.3.1 (Info and Relationships).
 */

import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { buildViolation } from '../../rule-catalog';
import { createScreenReaderContext } from '../../../utils/tool-details';
import { getScreenReaderDisplayName } from '../../../../screen-reader/screen-reader-type';

export interface AriaHiddenFocusableStats {
    totalFocusableElements: number;
    ariaHiddenFocusableCount: number;
}

export class AriaHiddenFocusableRule implements Rule<ScreenReaderContext, AriaHiddenFocusableStats> {
    readonly id = 'aria-hidden-focusable';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '4.1.2', level: 'A' },
            related: [{ criterion: '1.3.1', level: 'A' }],
        },
        summary: 'Focusable element has aria-hidden="true", creating silent focus',
    };

    async run(ctx: AuditContext): Promise<RuleResult<ScreenReaderContext, AriaHiddenFocusableStats>> {
        const { transcript } = ctx;
        const violations: ScreenReaderViolation[] = [];
        let totalFocusable = 0;
        const seen = new Set<string>();

        for (const result of transcript) {
            const strategyType = result.meta.name;

            if (strategyType !== 'tab') continue;

            for (let stepIndex = 0; stepIndex < result.navigationSteps.length; stepIndex++) {
                const step = result.navigationSteps[stepIndex]!;
                const htmlSnippet = step.htmlSnippet;

                if (!htmlSnippet) continue;

                totalFocusable++;

                if (seen.has(htmlSnippet)) continue;
                seen.add(htmlSnippet);

                if (this.hasAriaHidden(htmlSnippet)) {
                    const context = createScreenReaderContext(step, 'tab', stepIndex, ctx.screenReader);
                    const spokenText =
                        step.spokenPhrases.length > 0 ? step.spokenPhrases.join(', ') : '(nothing announced)';
                    const screenReaderDisplayName = getScreenReaderDisplayName(ctx.screenReader);

                    violations.push(
                        buildViolation({
                            ruleId: 'aria-hidden-focusable',
                            impact: 'critical',
                            stepId: `aria-hidden-focusable-${step.identifier}`,
                            message: `Focusable element has aria-hidden="true". Focus landed on this element but screen readers are instructed to ignore it, creating a confusing silent focus. ${screenReaderDisplayName} announced: "${spokenText}"`,
                            timestamp: step.timestamp,
                            context,
                            htmlSnippet: step.htmlSnippet,
                            screenReader: ctx.screenReader,
                        })
                    );
                }
            }
        }

        return {
            violations,
            stats: {
                totalFocusableElements: totalFocusable,
                ariaHiddenFocusableCount: violations.length,
            },
        };
    }

    private hasAriaHidden(htmlSnippet: string): boolean {
        return /aria-hidden\s*=\s*["']true["']/i.test(htmlSnippet);
    }
}

export const rule = new AriaHiddenFocusableRule();
