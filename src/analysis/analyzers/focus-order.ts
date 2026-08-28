/**
 * Analyzer: Focus Order
 * 
 * Detects focus order anomalies where the tab order significantly
 * differs from the visual/DOM order, potentially confusing users.
 * 
 * Maps to WCAG 2.4.3 (Focus Order).
 * 
 * Note: This is a heuristic analysis since we infer DOM position from
 * the order elements appear in the HTML. True visual position would
 * require layout information.
 */

import type { StrategyResult, NavigationStep } from '../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import type { NvdaViolation, NvdaToolDetails } from '../violation';

export interface FocusOrderAnalyzerResult {
    violations: NvdaViolation[];
    summary: {
        totalFocusableElements: number;
        anomaliesFound: number;
        tabOrderSequence: string[];
    };
}

interface FocusableElement {
    name: string;
    role: string;
    htmlSnippet: string | null;
    tabIndex: number;  // Position in tab order (0-based)
    domPosition: number | null;  // Estimated position in DOM/page HTML
    step: NavigationStep;
}

export function analyzeFocusOrder(
    strategyResults: StrategyResult[],
    pageHtml?: string
): FocusOrderAnalyzerResult {
    const violations: NvdaViolation[] = [];

    // Collect tab order from tab strategy
    const focusableElements: FocusableElement[] = [];

    for (const result of strategyResults) {
        const strategyType = result.meta.type ?? result.meta.name;

        if (strategyType !== 'tab') continue;

        for (let tabIndex = 0; tabIndex < result.navigationSteps.length; tabIndex++) {
            const step = result.navigationSteps[tabIndex]!;
            const node = step.axNode;

            const name = node?.name?.value ?? step.itemText ?? '';
            const role = node?.role?.value ?? '';

            // Estimate DOM position from page HTML if available
            let domPosition: number | null = null;
            if (pageHtml && step.htmlSnippet) {
                domPosition = estimateDomPosition(pageHtml, step.htmlSnippet);
            }

            focusableElements.push({
                name,
                role,
                htmlSnippet: step.htmlSnippet,
                tabIndex,
                domPosition,
                step,
            });
        }
    }

    const tabOrderSequence = focusableElements.map(el => el.name || `(${el.role})`);

    // Analyze for anomalies
    if (pageHtml) {
        // Method 1: Compare tab order vs DOM order
        const anomalies = detectDomOrderAnomalies(focusableElements);
        for (const anomaly of anomalies) {
            violations.push(createFocusOrderViolation(anomaly));
        }
    }

    // Method 2: Detect positive tabindex (always suspicious)
    const tabindexAnomalies = detectTabindexAnomalies(focusableElements);
    for (const anomaly of tabindexAnomalies) {
        violations.push(createTabindexViolation(anomaly));
    }

    return {
        violations,
        summary: {
            totalFocusableElements: focusableElements.length,
            anomaliesFound: violations.length,
            tabOrderSequence,
        },
    };
}

interface FocusOrderAnomaly {
    element: FocusableElement;
    previousElement: FocusableElement;
    issue: 'backwards-jump' | 'large-forward-jump';
    jumpDistance: number;
}

function detectDomOrderAnomalies(elements: FocusableElement[]): FocusOrderAnomaly[] {
    const anomalies: FocusOrderAnomaly[] = [];

    // Filter to elements with known DOM positions
    const withPositions = elements.filter(el => el.domPosition !== null);

    for (let i = 1; i < withPositions.length; i++) {
        const current = withPositions[i]!;
        const previous = withPositions[i - 1]!;

        const domJump = current.domPosition! - previous.domPosition!;

        // Backwards jump in DOM order (focus moved up the page)
        if (domJump < -1000) {  // Threshold: significant backwards movement
            anomalies.push({
                element: current,
                previousElement: previous,
                issue: 'backwards-jump',
                jumpDistance: Math.abs(domJump),
            });
        }

        // Large forward jump (skipped significant portion of page)
        // This is less concerning but might indicate issues
        if (domJump > 5000) {  // Threshold: jumped over large section
            anomalies.push({
                element: current,
                previousElement: previous,
                issue: 'large-forward-jump',
                jumpDistance: domJump,
            });
        }
    }

    return anomalies;
}

interface TabindexAnomaly {
    element: FocusableElement;
    tabindexValue: number;
}

function detectTabindexAnomalies(elements: FocusableElement[]): TabindexAnomaly[] {
    const anomalies: TabindexAnomaly[] = [];

    for (const element of elements) {
        const tabindexValue = extractTabindex(element.htmlSnippet);

        // Positive tabindex is almost always wrong
        if (tabindexValue !== null && tabindexValue > 0) {
            anomalies.push({
                element,
                tabindexValue,
            });
        }
    }

    return anomalies;
}

function estimateDomPosition(pageHtml: string, snippet: string): number | null {
    if (!snippet) return null;

    // Find position of this snippet in the page HTML
    // Use a portion of the snippet to handle minor differences
    const searchText = snippet.slice(0, Math.min(100, snippet.length));
    const position = pageHtml.indexOf(searchText);

    return position >= 0 ? position : null;
}

function extractTabindex(htmlSnippet: string | null): number | null {
    if (!htmlSnippet) return null;

    const match = htmlSnippet.match(/tabindex\s*=\s*["']?(-?\d+)["']?/i);
    if (match?.[1]) {
        return parseInt(match[1], 10);
    }
    return null;
}

function createToolDetails(element: FocusableElement): NvdaToolDetails {
    return {
        spokenPhrases: element.step.spokenPhrases,
        itemText: element.step.itemText,
        navigationStrategy: 'tab',
        stepIndex: element.tabIndex,
        axNode: element.step.axNode as NvdaToolDetails['axNode'],
    };
}

function createFocusOrderViolation(anomaly: FocusOrderAnomaly): NvdaViolation {
    const isBackwards = anomaly.issue === 'backwards-jump';

    const message = isBackwards
        ? `Focus jumped backwards in the page after "${anomaly.previousElement.name || anomaly.previousElement.role}". Focus moved to "${anomaly.element.name || anomaly.element.role}" which appears earlier in the DOM. This can disorient keyboard users.`
        : `Focus jumped over a large section of the page. After "${anomaly.previousElement.name || anomaly.previousElement.role}", focus moved to "${anomaly.element.name || anomaly.element.role}", skipping significant content.`;

    return {
        id: `focus-order-${anomaly.element.step.identifier}`,
        ruleId: 'focus-order-anomaly',
        wcag: {
            primary: { criterion: '2.4.3', level: 'A' },
        },
        impact: isBackwards ? 'serious' : 'moderate',
        message,
        element: {
            htmlSnippet: anomaly.element.htmlSnippet ?? undefined,
        },
        tool: 'nvda-audit',
        timestamp: anomaly.element.step.timestamp,
        toolDetails: createToolDetails(anomaly.element),
    };
}

function createTabindexViolation(anomaly: TabindexAnomaly): NvdaViolation {
    return {
        id: `positive-tabindex-${anomaly.element.step.identifier}`,
        ruleId: 'positive-tabindex',
        wcag: {
            primary: { criterion: '2.4.3', level: 'A' },
        },
        impact: 'serious',
        message: `Element has positive tabindex="${anomaly.tabindexValue}". Positive tabindex values disrupt natural focus order and should be avoided. Use tabindex="0" or rely on DOM order instead.`,
        element: {
            htmlSnippet: anomaly.element.htmlSnippet ?? undefined,
        },
        tool: 'nvda-audit',
        timestamp: anomaly.element.step.timestamp,
        toolDetails: createToolDetails(anomaly.element),
    };
}
