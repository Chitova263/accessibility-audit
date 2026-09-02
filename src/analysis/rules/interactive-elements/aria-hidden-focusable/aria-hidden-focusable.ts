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
import { createScreenReaderContext } from '../../../utils/tool-details';
import { captureScreenshotToFile } from '../../../utils/screenshot-capture';
import { getScreenReaderDisplayName } from '../../../../screen-reader/drivers/types';

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
        impact: 'critical',
        summary: 'Focusable element has aria-hidden="true", creating silent focus',
    };

    async run(ctx: AuditContext): Promise<RuleResult<ScreenReaderContext, AriaHiddenFocusableStats>> {
        const { transcript, page, cdp, screenshotsDir } = ctx;
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
                    const backendNodeId = step.axNode?.backendDOMNodeId;
                    if (typeof backendNodeId === 'number') {
                        const filename = `${this.id}-${step.identifier}`;
                        context.screenshot = await captureScreenshotToFile(
                            page,
                            cdp,
                            backendNodeId,
                            screenshotsDir,
                            filename,
                            { label: `${this.id}: ${this.meta.summary}` }
                        );
                    }
                    violations.push(this.createViolation(step, context, ctx.screenReader));
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
        context: ScreenReaderContext,
        screenReader: AuditContext['screenReader']
    ): ScreenReaderViolation {
        const spokenText = step.spokenPhrases.length > 0 ? step.spokenPhrases.join(', ') : '(nothing announced)';
        const screenReaderDisplayName = getScreenReaderDisplayName(screenReader);

        return {
            id: `aria-hidden-focusable-${step.identifier}`,
            rule: {
                id: this.id,
                summary: this.meta.summary,
                wcag: this.meta.wcag,
                impact: this.meta.impact,
            },
            message: `Focusable element has aria-hidden="true". Focus landed on this element but screen readers are instructed to ignore it, creating a confusing silent focus. ${screenReaderDisplayName} announced: "${spokenText}"`,
            element: step.htmlSnippet != null ? { htmlSnippet: step.htmlSnippet } : {},
            tool: 'screen-reader-audit',
            timestamp: step.timestamp,
            context,
        };
    }
}

export const rule = new AriaHiddenFocusableRule();
