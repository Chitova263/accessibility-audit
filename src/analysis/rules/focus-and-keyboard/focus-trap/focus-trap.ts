import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { buildViolation } from '../../rule-catalog';
import { createScreenReaderContext } from '../../../utils/tool-details';

interface FocusTrapStats {
    tabStrategiesChecked: number;
    focusTrapsFound: number;
}

class FocusTrapRule implements Rule<ScreenReaderContext, FocusTrapStats> {
    readonly id = 'focus-trap';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '2.1.2', level: 'A' },
        },
        summary: 'Keyboard focus trap where the user cannot escape using Tab',
    };

    async run(ctx: AuditContext): Promise<RuleResult<ScreenReaderContext, FocusTrapStats>> {
        const { transcript } = ctx;
        const violations: ScreenReaderViolation[] = [];
        let tabStrategiesChecked = 0;

        for (const result of transcript) {
            const strategyType = result.meta.name;

            if (strategyType !== 'tab') continue;

            tabStrategiesChecked++;

            if (result.completionReason.kind === 'trapped') {
                const steps = result.navigationSteps;
                const trappedStep = steps[steps.length - 1];

                if (trappedStep) {
                    const context = createScreenReaderContext(trappedStep, 'tab', steps.length - 1, ctx.screenReader);

                    violations.push(
                        buildViolation({
                            ruleId: 'focus-trap',
                            impact: 'critical',
                            stepId: `focus-trap-${trappedStep.identifier}`,
                            message: `Keyboard focus trap detected after ${steps.length} tab presses. Users cannot navigate away from this element using the keyboard. Element text: "${trappedStep.focusedElementText}"`,
                            timestamp: trappedStep.timestamp,
                            context,
                            htmlSnippet: trappedStep.htmlSnippet,
                            screenReader: ctx.screenReader,
                        })
                    );
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
}

export const rule = new FocusTrapRule();
