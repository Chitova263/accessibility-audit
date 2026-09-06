import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import type { StrategyResult, NavigationStep } from '../../../../screen-reader/strategies/navigation-strategy';
import { buildViolation } from '../../rule-catalog';
import { createScreenReaderContext } from '../../../utils/tool-details';
import { getRole, getName } from '../../../../types/ax-utils';

interface PositiveTabindexStats {
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

class PositiveTabindexRule implements Rule<ScreenReaderContext, PositiveTabindexStats> {
    readonly id = 'positive-tabindex';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '2.4.3', level: 'A' },
        },
        summary: 'Element has positive tabindex disrupting natural order',
    };

    async run(ctx: AuditContext): Promise<RuleResult<ScreenReaderContext, PositiveTabindexStats>> {
        const { transcript } = ctx;
        const violations: ScreenReaderViolation[] = [];

        const focusableElements = this.collectTabOrderElements(transcript);
        const anomalies = this.detectAnomalies(focusableElements);

        for (const anomaly of anomalies) {
            const context = createScreenReaderContext(
                anomaly.element.step,
                'tab',
                anomaly.element.tabIndex,
                ctx.screenReader
            );
            violations.push(
                buildViolation({
                    ruleId: 'positive-tabindex',
                    impact: 'serious',
                    stepId: `positive-tabindex-${anomaly.element.step.identifier}`,
                    message: `Element has positive tabindex="${anomaly.tabindexValue}". Positive tabindex values disrupt natural focus order and should be avoided. Use tabindex="0" or rely on DOM order instead.`,
                    timestamp: anomaly.element.step.timestamp,
                    context,
                    htmlSnippet: anomaly.element.htmlSnippet,
                    screenReader: ctx.screenReader,
                })
            );
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
            const strategyType = result.meta.name;
            if (strategyType !== 'tab') continue;

            for (let tabIndex = 0; tabIndex < result.navigationSteps.length; tabIndex++) {
                const step = result.navigationSteps[tabIndex]!;
                const node = step.axNode;

                const name = getName(node) ?? step.focusedElementText ?? '';
                const role = getRole(node) ?? '';
                const backendNodeId = node?.backendDOMNodeId;

                focusableElements.push({
                    name,
                    role,
                    htmlSnippet: step.htmlSnippet,
                    tabIndex,
                    step,
                    backendNodeId,
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
}

export const rule = new PositiveTabindexRule();
