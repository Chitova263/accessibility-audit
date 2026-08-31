/**
 * Rule: Positive Tabindex
 *
 * Detects elements with positive tabindex values that disrupt
 * the natural DOM focus order for keyboard users.
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
import { captureScreenshotToFile } from '../../../utils/screenshot-capture';

export interface PositiveTabindexStats {
    totalFocusableElements: number;
    violationsFound: number;
}

interface FocusableElement {
    name: string;
    role: string;
    htmlSnippet: string | null;
    tabIndex: number;
    step: NavigationStep;
    backendNodeId: number | undefined;
}

interface TabindexAnomaly {
    element: FocusableElement;
    tabindexValue: number;
}

export class PositiveTabindexRule implements Rule<NvdaContext, PositiveTabindexStats> {
    readonly id = 'positive-tabindex';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '2.4.3', level: 'A' },
        },
        impact: 'serious',
        summary: 'Element has positive tabindex disrupting natural order',
    };

    async run(ctx: AuditContext): Promise<RuleResult<NvdaContext, PositiveTabindexStats>> {
        const { transcript, page, cdp, screenshotsDir } = ctx;
        const violations: NvdaViolation[] = [];

        const focusableElements = this.collectTabOrderElements(transcript);
        const anomalies = this.detectAnomalies(focusableElements);

        for (const anomaly of anomalies) {
            const context = createNvdaContext(anomaly.element.step, 'tab', anomaly.element.tabIndex);
            if (typeof anomaly.element.backendNodeId === 'number') {
                const filename = `${this.id}-${anomaly.element.step.identifier}`;
                context.screenshot = await captureScreenshotToFile(
                    page,
                    cdp,
                    anomaly.element.backendNodeId,
                    screenshotsDir,
                    filename
                );
            }
            violations.push(this.createViolation(anomaly, context));
        }

        return {
            violations,
            stats: {
                totalFocusableElements: focusableElements.length,
                violationsFound: violations.length,
            },
        };
    }

    private collectTabOrderElements(transcript: StrategyResult[]): FocusableElement[] {
        const focusableElements: FocusableElement[] = [];

        for (const result of transcript) {
            const strategyType = result.meta.type ?? result.meta.name;
            if (strategyType !== 'tab') continue;

            for (let tabIndex = 0; tabIndex < result.navigationSteps.length; tabIndex++) {
                const step = result.navigationSteps[tabIndex]!;
                const node = step.axNode;

                const name = node?.name?.value ?? step.itemText ?? '';
                const role = node?.role?.value ?? '';
                const backendNodeId = step.axNode?.backendDOMNodeId ?? null;

                focusableElements.push({
                    name,
                    role,
                    htmlSnippet: step.htmlSnippet,
                    tabIndex,
                    step,
                    backendNodeId: backendNodeId ?? undefined,
                });
            }
        }

        return focusableElements;
    }

    private detectAnomalies(elements: FocusableElement[]): TabindexAnomaly[] {
        const anomalies: TabindexAnomaly[] = [];

        for (const element of elements) {
            const tabindexValue = this.extractTabindex(element.htmlSnippet);
            if (tabindexValue !== null && tabindexValue > 0) {
                anomalies.push({ element, tabindexValue });
            }
        }

        return anomalies;
    }

    private extractTabindex(htmlSnippet: string | null): number | null {
        if (!htmlSnippet) return null;

        const match = htmlSnippet.match(/tabindex\s*=\s*["']?(-?\d+)["']?/i);
        if (match?.[1]) {
            return parseInt(match[1], 10);
        }
        return null;
    }

    private createViolation(anomaly: TabindexAnomaly, context: NvdaContext): NvdaViolation {
        return {
            id: `positive-tabindex-${anomaly.element.step.identifier}`,
            rule: {
                id: this.id,
                summary: this.meta.summary,
                wcag: this.meta.wcag,
                impact: this.meta.impact,
            },
            message: `Element has positive tabindex="${anomaly.tabindexValue}". Positive tabindex values disrupt natural focus order and should be avoided. Use tabindex="0" or rely on DOM order instead.`,
            ...(anomaly.element.htmlSnippet != null ? { element: { htmlSnippet: anomaly.element.htmlSnippet } } : {}),
            tool: 'nvda-audit',
            timestamp: anomaly.element.step.timestamp,
            context,
        };
    }
}

export const rule = new PositiveTabindexRule();


