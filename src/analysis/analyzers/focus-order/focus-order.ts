/**
 * Analyzer: Focus Order
 *
 * Detects focus order anomalies where the tab order significantly
 * differs from the reading order, potentially confusing users.
 *
 * Maps to WCAG 2.4.3 (Focus Order).
 */

import type {
    StrategyResult,
    NavigationStep,
} from '../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import type { NvdaViolation, NvdaContext } from '../../core/violation';
import type { AuditContext } from '../../core/context';
import { createNvdaContext as buildNvdaContext } from '../../utils/tool-details';
import { getRule } from '../../registry/rule-catalog';
import { captureScreenshot } from '../../utils/screenshot-capture';

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
    tabIndex: number;
    readingOrderIndex: number | null;
    step: NavigationStep;
    backendNodeId: number | undefined;
}

export async function analyzeFocusOrder(ctx: AuditContext): Promise<FocusOrderAnalyzerResult> {
    const { transcript, page, cdp } = ctx;
    const violations: NvdaViolation[] = [];

    const readingOrder = buildReadingOrderIndex(transcript);

    // Collect tab order from tab strategy
    const focusableElements: FocusableElement[] = [];

    for (const result of transcript) {
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
                backendNodeId: backendNodeId ?? undefined,
            });
        }
    }

    const tabOrderSequence = focusableElements.map((el) => el.name || `(${el.role})`);

    // Method 1: Compare tab order against reading order (no screenshot - navigation flow issue)
    const anomalies = detectReadingOrderAnomalies(focusableElements);
    for (const anomaly of anomalies) {
        violations.push(createFocusOrderViolation(anomaly));
    }

    // Method 2: Detect positive tabindex (has screenshot)
    const tabindexAnomalies = detectTabindexAnomalies(focusableElements);
    for (const anomaly of tabindexAnomalies) {
        const context = buildNvdaContext(anomaly.element.step, 'tab', anomaly.element.tabIndex);
        if (typeof anomaly.element.backendNodeId === 'number') {
            context.screenshot = (await captureScreenshot(page, cdp, anomaly.element.backendNodeId)) ?? undefined;
        }
        violations.push(createTabindexViolation(anomaly, context));
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

function buildReadingOrderIndex(transcript: StrategyResult[]): Map<number, number> {
    const readingOrder = new Map<number, number>();

    const arrowResult = transcript.find((r) => r.meta.type === 'arrow');
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

function detectReadingOrderAnomalies(elements: FocusableElement[]): FocusOrderAnomaly[] {
    const anomalies: FocusOrderAnomaly[] = [];
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

function createFocusOrderViolation(anomaly: FocusOrderAnomaly): NvdaViolation {
    const previousLabel = anomaly.previousElement.name || anomaly.previousElement.role;
    const currentLabel = anomaly.element.name || anomaly.element.role;

    return {
        id: `focus-order-${anomaly.element.step.identifier}`,
        rule: getRule('focus-order-anomaly'),
        message: `Focus jumped backwards through the page. After "${previousLabel}", focus moved to "${currentLabel}", which is announced ${anomaly.jumpDistance} positions earlier when reading the page linearly. This can disorient keyboard users.`,
        ...(anomaly.element.htmlSnippet != null ? { element: { htmlSnippet: anomaly.element.htmlSnippet } } : {}),
        tool: 'nvda-audit',
        timestamp: anomaly.element.step.timestamp,
        context: buildNvdaContext(anomaly.element.step, 'tab', anomaly.element.tabIndex),
    };
}

function createTabindexViolation(anomaly: TabindexAnomaly, context: NvdaContext): NvdaViolation {
    return {
        id: `positive-tabindex-${anomaly.element.step.identifier}`,
        rule: getRule('positive-tabindex'),
        message: `Element has positive tabindex="${anomaly.tabindexValue}". Positive tabindex values disrupt natural focus order and should be avoided. Use tabindex="0" or rely on DOM order instead.`,
        ...(anomaly.element.htmlSnippet != null ? { element: { htmlSnippet: anomaly.element.htmlSnippet } } : {}),
        tool: 'nvda-audit',
        timestamp: anomaly.element.step.timestamp,
        context,
    };
}
