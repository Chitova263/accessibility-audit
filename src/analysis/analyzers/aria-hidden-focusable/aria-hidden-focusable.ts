/**
 * Analyzer: aria-hidden on Focusable
 *
 * Detects elements with aria-hidden="true" that received keyboard focus.
 * This creates a confusing experience where focus lands on an element
 * but the screen reader announces nothing.
 *
 * Maps to WCAG 4.1.2 (Name, Role, Value) and 1.3.1 (Info and Relationships).
 */

import type { NvdaViolation, NvdaContext } from '../../core/violation';
import type { AuditContext } from '../../core/context';
import { createNvdaContext } from '../../utils/tool-details';
import { getRule } from '../../registry/rule-catalog';
import { captureScreenshot } from '../../utils/screenshot-capture';

export interface AriaHiddenFocusableAnalyzerResult {
    violations: NvdaViolation[];
    summary: {
        totalFocusableElements: number;
        ariaHiddenFocusableCount: number;
    };
}

export async function analyzeAriaHiddenFocusable(ctx: AuditContext): Promise<AriaHiddenFocusableAnalyzerResult> {
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

            // Check for aria-hidden="true" in the element
            if (hasAriaHidden(htmlSnippet)) {
                const context = createNvdaContext(step, 'tab', stepIndex);
                const backendNodeId = step.axNode?.backendDOMNodeId;
                if (typeof backendNodeId === 'number') {
                    context.screenshot = (await captureScreenshot(page, cdp, backendNodeId)) ?? undefined;
                }
                violations.push(createAriaHiddenFocusableViolation(step, context));
            }
        }
    }

    return {
        violations,
        summary: {
            totalFocusableElements: totalFocusable,
            ariaHiddenFocusableCount: violations.length,
        },
    };
}

function hasAriaHidden(htmlSnippet: string): boolean {
    return /aria-hidden\s*=\s*["']true["']/i.test(htmlSnippet);
}

function createAriaHiddenFocusableViolation(
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
        rule: getRule('aria-hidden-focusable'),
        message: `Focusable element has aria-hidden="true". Focus landed on this element but screen readers are instructed to ignore it, creating a confusing silent focus. NVDA announced: "${spokenText}"`,
        element: step.htmlSnippet != null ? { htmlSnippet: step.htmlSnippet } : {},
        tool: 'nvda-audit',
        timestamp: step.timestamp,
        context,
    };
}
