/**
 * Rule: Focus Order Anomaly
 *
 * Detects focus order anomalies where the tab order significantly
 * differs from the reading order, potentially confusing users.
 *
 * Maps to WCAG 2.4.3 (Focus Order).
 */

import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { NvdaContext, NvdaViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import type {
    StrategyResult,
    NavigationStep,
} from '../../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import { createNvdaContext } from '../../../utils/tool-details';

const BACKWARDS_JUMP_THRESHOLD = 5;

export interface FocusOrderAnomalyStats {
    totalFocusableElements: number;
    elementsWithReadingPosition: number;
    anomaliesFound: number;
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

interface FocusOrderAnomaly {
    element: FocusableElement;
    previousElement: FocusableElement;
    jumpDistance: number;
}

export class FocusOrderAnomalyRule implements Rule<NvdaContext, FocusOrderAnomalyStats> {
    readonly id = 'focus-order-anomaly';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '2.4.3', level: 'A' },
        },
        impact: 'serious',
        summary: 'Focus jumps backwards or skips large sections',
    };

    async run(ctx: AuditContext): Promise<RuleResult<NvdaContext, FocusOrderAnomalyStats>> {
        const { transcript } = ctx;
        const violations: NvdaViolation[] = [];

        const readingOrder = this.buildReadingOrderIndex(transcript);
        const focusableElements = this.collectTabOrderElements(transcript, readingOrder);
        const anomalies = this.detectAnomalies(focusableElements);

        for (const anomaly of anomalies) {
            violations.push(this.createViolation(anomaly));
        }

        return {
            violations,
            stats: {
                totalFocusableElements: focusableElements.length,
                elementsWithReadingPosition: focusableElements.filter((el) => el.readingOrderIndex !== null).length,
                anomaliesFound: violations.length,
            },
        };
    }

    private buildReadingOrderIndex(transcript: StrategyResult[]): Map<number, number> {
        const readingOrder = new Map<number, number>();

        const arrowResult = transcript.find((r) => r.meta.type === 'arrow');
        if (!arrowResult) return readingOrder;

        for (let i = 0; i < arrowResult.navigationSteps.length; i++) {
            const backendNodeId = this.getBackendDomNodeId(arrowResult.navigationSteps[i]!);
            if (backendNodeId != null && !readingOrder.has(backendNodeId)) {
                readingOrder.set(backendNodeId, i);
            }
        }

        return readingOrder;
    }

    private collectTabOrderElements(
        transcript: StrategyResult[],
        readingOrder: Map<number, number>
    ): FocusableElement[] {
        const focusableElements: FocusableElement[] = [];

        for (const result of transcript) {
            const strategyType = result.meta.type ?? result.meta.name;
            if (strategyType !== 'tab') continue;

            for (let tabIndex = 0; tabIndex < result.navigationSteps.length; tabIndex++) {
                const step = result.navigationSteps[tabIndex]!;
                const node = step.axNode;

                const name = node?.name?.value ?? step.itemText ?? '';
                const role = node?.role?.value ?? '';
                const backendNodeId = this.getBackendDomNodeId(step);
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

        return focusableElements;
    }

    private getBackendDomNodeId(step: NavigationStep): number | null {
        return step.axNode?.backendDOMNodeId ?? null;
    }

    private detectAnomalies(elements: FocusableElement[]): FocusOrderAnomaly[] {
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

    private createViolation(anomaly: FocusOrderAnomaly): NvdaViolation {
        const previousLabel = anomaly.previousElement.name || anomaly.previousElement.role;
        const currentLabel = anomaly.element.name || anomaly.element.role;

        const context: NvdaContext = createNvdaContext(anomaly.element.step, 'tab', anomaly.element.tabIndex);

        return {
            id: `focus-order-${anomaly.element.step.identifier}`,
            rule: {
                id: this.id,
                summary: this.meta.summary,
                wcag: this.meta.wcag,
                impact: this.meta.impact,
            },
            message: `Focus jumped backwards through the page. After "${previousLabel}", focus moved to "${currentLabel}", which is announced ${anomaly.jumpDistance} positions earlier when reading the page linearly. This can disorient keyboard users.`,
            ...(anomaly.element.htmlSnippet != null ? { element: { htmlSnippet: anomaly.element.htmlSnippet } } : {}),
            tool: 'nvda-audit',
            timestamp: anomaly.element.step.timestamp,
            context,
        };
    }
}

export const rule = new FocusOrderAnomalyRule();


