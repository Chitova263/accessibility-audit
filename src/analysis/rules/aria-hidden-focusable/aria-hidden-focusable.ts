/**
 * Rule: aria-hidden on Focusable
 *
 * Detects elements with aria-hidden="true" that received keyboard focus.
 * This creates a confusing experience where focus lands on an element
 * but the screen reader announces nothing.
 *
 * Maps to WCAG 4.1.2 (Name, Role, Value) and 1.3.1 (Info and Relationships).
 */

import type { Rule, RuleMeta, RuleResult } from '../../core/rule';
import type { NvdaContext, NvdaViolation } from '../../core/violation';
import type { AuditContext } from '../../core/context';
import { createNvdaContext } from '../../utils/tool-details';
import { captureScreenshot } from '../../utils/screenshot-capture';

export interface AriaHiddenFocusableStats {
    totalFocusableElements: number;
    ariaHiddenFocusableCount: number;
}

export class AriaHiddenFocusableRule implements Rule<NvdaContext, AriaHiddenFocusableStats> {
    readonly id = 'aria-hidden-focusable';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '4.1.2', level: 'A' },
            related: [{ criterion: '1.3.1', level: 'A' }],
        },
        impact: 'critical',
        summary: 'Focusable element has aria-hidden="true", creating silent focus',
    };

    async run(ctx: AuditContext): Promise<RuleResult<NvdaContext, AriaHiddenFocusableStats>> {
        const { transcript, page, cdp } = ctx;
        const violations: NvdaViolation[] = [];
        let totalFocusable = 0;
        const seen = new Set<string>();

        for (const result of transcript) {
            const strategyType = result.meta.type ?? result.meta.name;

            // Only check focus mode (Tab) - these are elements that actually received focus
            if (strategyType !== 'tab') continue;

            for (let stepIndex = 0; stepIndex < result.navigationSteps.length; stepIndex++) {
                const step = result.navigationSteps[stepIndex]!;
                const htmlSnippet = step.htmlSnippet;

                if (!htmlSnippet) continue;

                totalFocusable++;

                // Deduplicate by snippet
                if (seen.has(htmlSnippet)) continue;
                seen.add(htmlSnippet);

                if (this.hasAriaHidden(htmlSnippet)) {
                    const context = createNvdaContext(step, 'tab', stepIndex);
                    const backendNodeId = step.axNode?.backendDOMNodeId;
                    if (typeof backendNodeId === 'number') {
                        context.screenshot = (await captureScreenshot(page, cdp, backendNodeId)) ?? undefined;
                    }
                    violations.push(this.createViolation(step, context));
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

    private createViolation(
        step: {
            identifier: string;
            spokenPhrases: string[];
            itemText: string;
            timestamp: number;
            htmlSnippet: string | null;
        },
        context: NvdaContext
    ): NvdaViolation {
        const spokenText = step.spokenPhrases.length > 0 ? step.spokenPhrases.join(', ') : '(nothing announced)';

        return {
            id: `aria-hidden-focusable-${step.identifier}`,
            rule: {
                id: this.id,
                summary: this.meta.summary,
                wcag: this.meta.wcag,
                impact: this.meta.impact,
            },
            message: `Focusable element has aria-hidden="true". Focus landed on this element but screen readers are instructed to ignore it, creating a confusing silent focus. NVDA announced: "${spokenText}"`,
            element: step.htmlSnippet != null ? { htmlSnippet: step.htmlSnippet } : {},
            tool: 'nvda-audit',
            timestamp: step.timestamp,
            context,
        };
    }
}

export const rule = new AriaHiddenFocusableRule();
