/**
 * Analyzer: Focus Order
 *
 * Detects focus order anomalies where the tab order significantly
 * differs from the reading order, potentially confusing users.
 *
 * Maps to WCAG 2.4.3 (Focus Order).
 *
 * Reading order comes from the Arrow navigation walk, which reads the page
 * linearly in DOM order. Tab steps are matched to it by backendDOMNodeId, so a
 * tab stop's reading position is the position NVDA actually announced it at
 * rather than an inferred one. Elements the arrow walk never reached have no
 * reading position and are skipped rather than guessed at.
 */

import type {
    StrategyResult,
    NavigationStep,
} from '../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import type { NvdaViolation, NvdaToolDetails } from '../violation';
import type { TranscriptContext } from '../context';
import { createToolDetails as buildToolDetails } from '../tool-details';
import { ruleMetadata } from '../rule-catalog';

/**
 * How far backwards through the reading order focus must jump before it counts
 * as an anomaly. Small backwards movements are tolerated because the arrow walk
 * matches announcements to AX nodes by text, so neighbouring positions can be
 * off by one or two.
 */
const BACKWARDS_JUMP_THRESHOLD = 5;

export interface FocusOrderAnalyzerResult {
    violations: NvdaViolation[];
    summary: {
        totalFocusableElements: number;
        elementsWithReadingPosition: number;
        anomaliesFound: number;
        tabOrderSequence: string[];
    };
}

interface FocusableElement {
    name: string;
    role: string;
    htmlSnippet: string | null;
    tabIndex: number; // Position in tab order (0-based)
    readingOrderIndex: number | null; // Position in the linear reading order
    step: NavigationStep;
}

export function analyzeFocusOrder({ strategyResults }: TranscriptContext): FocusOrderAnalyzerResult {
    const violations: NvdaViolation[] = [];

    const readingOrder = buildReadingOrderIndex(strategyResults);

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

            const backendNodeId = getBackendDomNodeId(step);
            const readingOrderIndex = backendNodeId != null ? (readingOrder.get(backendNodeId) ?? null) : null;

            focusableElements.push({
                name,
                role,
                htmlSnippet: step.htmlSnippet,
                tabIndex,
                readingOrderIndex,
                step,
            });
        }
    }

    const tabOrderSequence = focusableElements.map((el) => el.name || `(${el.role})`);

    // Method 1: Compare tab order against reading order
    const anomalies = detectReadingOrderAnomalies(focusableElements);
    for (const anomaly of anomalies) {
        violations.push(createFocusOrderViolation(anomaly));
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
            elementsWithReadingPosition: focusableElements.filter((el) => el.readingOrderIndex !== null).length,
            anomaliesFound: violations.length,
            tabOrderSequence,
        },
    };
}

/**
 * Maps each element the arrow walk reached to its position in the reading order.
 * The first occurrence wins, so an element announced twice keeps its earliest
 * position.
 */
function buildReadingOrderIndex(strategyResults: StrategyResult[]): Map<number, number> {
    const readingOrder = new Map<number, number>();

    const arrowResult = strategyResults.find((r) => r.meta.type === 'arrow');
    if (!arrowResult) return readingOrder;

    for (let i = 0; i < arrowResult.navigationSteps.length; i++) {
        const backendNodeId = getBackendDomNodeId(arrowResult.navigationSteps[i]!);
        if (backendNodeId != null && !readingOrder.has(backendNodeId)) {
            readingOrder.set(backendNodeId, i);
        }
    }

    return readingOrder;
}

function getBackendDomNodeId(step: NavigationStep): number | null {
    return step.axNode?.backendDOMNodeId ?? null;
}

interface FocusOrderAnomaly {
    element: FocusableElement;
    previousElement: FocusableElement;
    jumpDistance: number;
}

/**
 * Flags tab stops that move backwards through the reading order.
 *
 * Only backwards movement is reported. Tab deliberately skips non-focusable
 * content, so a large forward jump is what tab navigation is for rather than a
 * defect.
 */
function detectReadingOrderAnomalies(elements: FocusableElement[]): FocusOrderAnomaly[] {
    const anomalies: FocusOrderAnomaly[] = [];

    // Filter to elements the arrow walk also reached
    const withPositions = elements.filter((el) => el.readingOrderIndex !== null);

    for (let i = 1; i < withPositions.length; i++) {
        const current = withPositions[i]!;
        const previous = withPositions[i - 1]!;

        const jump = current.readingOrderIndex! - previous.readingOrderIndex!;

        if (jump < -BACKWARDS_JUMP_THRESHOLD) {
            anomalies.push({
                element: current,
                previousElement: previous,
                jumpDistance: Math.abs(jump),
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

function extractTabindex(htmlSnippet: string | null): number | null {
    if (!htmlSnippet) return null;

    const match = htmlSnippet.match(/tabindex\s*=\s*["']?(-?\d+)["']?/i);
    if (match?.[1]) {
        return parseInt(match[1], 10);
    }
    return null;
}

function createToolDetails(element: FocusableElement): NvdaToolDetails {
    return buildToolDetails(element.step, 'tab', element.tabIndex);
}

function createFocusOrderViolation(anomaly: FocusOrderAnomaly): NvdaViolation {
    const previousLabel = anomaly.previousElement.name || anomaly.previousElement.role;
    const currentLabel = anomaly.element.name || anomaly.element.role;

    return {
        id: `focus-order-${anomaly.element.step.identifier}`,
        ...ruleMetadata('focus-order-anomaly'),
        message: `Focus jumped backwards through the page. After "${previousLabel}", focus moved to "${currentLabel}", which is announced ${anomaly.jumpDistance} positions earlier when reading the page linearly. This can disorient keyboard users.`,
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
        ...ruleMetadata('positive-tabindex'),
        message: `Element has positive tabindex="${anomaly.tabindexValue}". Positive tabindex values disrupt natural focus order and should be avoided. Use tabindex="0" or rely on DOM order instead.`,
        element: {
            htmlSnippet: anomaly.element.htmlSnippet ?? undefined,
        },
        tool: 'nvda-audit',
        timestamp: anomaly.element.step.timestamp,
        toolDetails: createToolDetails(anomaly.element),
    };
}
