/**
 * Rule: Focus Trap
 *
 * Detects keyboard focus traps where users cannot escape
 * using standard keyboard navigation.
 *
 * Maps to WCAG 2.1.2 (No Keyboard Trap).
 */

import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { createScreenReaderContext } from '../../../utils/tool-details';
import type { ScreenReaderName } from '../../../../screen-reader/drivers/types';

export interface FocusTrapStats {
    tabStrategiesChecked: number;
    focusTrapsFound: number;
}

export class FocusTrapRule implements Rule<ScreenReaderContext, FocusTrapStats> {
    readonly id = 'focus-trap';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '2.1.2', level: 'A' },
        },
        impact: 'critical',
        summary: 'Keyboard focus trap where the user cannot escape using Tab',
    };

    async run(ctx: AuditContext): Promise<RuleResult<ScreenReaderContext, FocusTrapStats>> {
        const { transcript } = ctx;
        const violations: ScreenReaderViolation[] = [];
        let tabStrategiesChecked = 0;

        for (const result of transcript) {
            const strategyType = result.meta.type ?? result.meta.name;

            if (strategyType !== 'tab') continue;

            tabStrategiesChecked++;

            if (result.completionReason.kind === 'trapped') {
                const steps = result.navigationSteps;
                const trappedStep = steps[steps.length - 1];

                if (trappedStep) {
                    violations.push(this.createViolation(trappedStep, steps.length, ctx.screenReader));
                }
            }
        }

        return {
            violations,
            stats: {
                tabStrategiesChecked,
                focusTrapsFound: violations.length,
            },
        };
    }

    private createViolation(
        step: {
            identifier: string;
            spokenPhrases: string[];
            itemText: string;
            timestamp: number;
            htmlSnippet: string | null;
            axNode: unknown;
        },
        stepsBeforeTrap: number,
        screenReader: ScreenReaderName
    ): ScreenReaderViolation {
        const context = createScreenReaderContext(step, 'tab', stepsBeforeTrap - 1, screenReader);

        return {
            id: `focus-trap-${step.identifier}`,
            rule: {
                id: this.id,
                summary: this.meta.summary,
                wcag: this.meta.wcag,
                impact: this.meta.impact,
            },
            message: `Keyboard focus trap detected after ${stepsBeforeTrap} tab presses. Users cannot navigate away from this element using the keyboard. Element text: "${step.itemText}"`,
            element: step.htmlSnippet != null ? { htmlSnippet: step.htmlSnippet } : {},
            tool: 'nvda-audit',
            timestamp: step.timestamp,
            context,
        };
    }
}

export const rule = new FocusTrapRule();
