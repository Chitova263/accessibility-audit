/**
 * Analyzer: aria-hidden on Focusable
 *
 * Detects elements with aria-hidden="true" that received keyboard focus.
 * This creates a confusing experience where focus lands on an element
 * but the screen reader announces nothing.
 *
 * Maps to WCAG 4.1.2 (Name, Role, Value) and 1.3.1 (Info and Relationships).
 */

import type { StrategyResult } from '../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import type { NvdaViolation, NvdaToolDetails } from '../violation';

export interface AriaHiddenFocusableAnalyzerResult {
    violations: NvdaViolation[];
    summary: {
        totalFocusableElements: number;
        ariaHiddenFocusableCount: number;
    };
}

export function analyzeAriaHiddenFocusable(strategyResults: StrategyResult[]): AriaHiddenFocusableAnalyzerResult {
    const violations: NvdaViolation[] = [];
    let totalFocusable = 0;
    const seen = new Set<string>();

    for (const result of strategyResults) {
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

            // Check for aria-hidden="true" in the element or its representation
            if (hasAriaHidden(htmlSnippet)) {
                violations.push(createAriaHiddenFocusableViolation(step, stepIndex));
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
    // Match aria-hidden="true" or aria-hidden='true'
    return /aria-hidden\s*=\s*["']true["']/i.test(htmlSnippet);
}

function createAriaHiddenFocusableViolation(
    step: {
        identifier: string;
        spokenPhrases: string[];
        itemText: string;
        timestamp: number;
        htmlSnippet: string | null;
        axNode: unknown;
    },
    stepIndex: number
): NvdaViolation {
    const toolDetails: NvdaToolDetails = {
        spokenPhrases: step.spokenPhrases,
        itemText: step.itemText,
        navigationStrategy: 'tab',
        stepIndex,
        axNode: step.axNode as NvdaToolDetails['axNode'],
    };

    const spokenText = step.spokenPhrases.length > 0 ? step.spokenPhrases.join(', ') : '(nothing announced)';

    return {
        id: `aria-hidden-focusable-${step.identifier}`,
        ruleId: 'aria-hidden-focusable',
        wcag: {
            primary: { criterion: '4.1.2', level: 'A' },
            related: [{ criterion: '1.3.1', level: 'A' }],
        },
        impact: 'critical',
        message: `Focusable element has aria-hidden="true". Focus landed on this element but screen readers are instructed to ignore it, creating a confusing silent focus. NVDA announced: "${spokenText}"`,
        element: {
            htmlSnippet: step.htmlSnippet ?? undefined,
        },
        tool: 'nvda-audit',
        timestamp: step.timestamp,
        toolDetails,
    };
}
