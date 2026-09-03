import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { buildViolation } from '../../rule-catalog';
import { createScreenReaderContext } from '../../../utils/tool-details';
import { capitalize } from '../../../utils/string-utils';
import {
    collectElementsByStrategy,
    countByRole,
    createSignature,
    isLikelyInTabOrder,
} from '../../../utils/tab-order-helpers';

export interface ButtonNotInTabOrderStats {
    buttonsInBrowseMode: number;
    buttonsInFocusMode: number;
    violationsFound: number;
}

export class ButtonNotInTabOrderRule implements Rule<ScreenReaderContext, ButtonNotInTabOrderStats> {
    readonly id = 'button-not-in-tab-order';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '2.1.1', level: 'A' },
        },
        summary: 'Button reachable via B key but not Tab',
    };

    async run(ctx: AuditContext): Promise<RuleResult<ScreenReaderContext, ButtonNotInTabOrderStats>> {
        const { transcript } = ctx;
        const violations: ScreenReaderViolation[] = [];

        const { elements: buttons, tabOrderSignatures } = collectElementsByStrategy(transcript, 'button', 'button');

        for (const button of buttons) {
            const signature = createSignature(button.step);

            if (!tabOrderSignatures.has(signature) && !isLikelyInTabOrder(button, tabOrderSignatures)) {
                const context = createScreenReaderContext(button.step, button.strategyType, 0, ctx.screenReader);

                violations.push(
                    buildViolation({
                        ruleId: 'button-not-in-tab-order',
                        impact: 'serious',
                        stepId: `${this.id}-${button.step.identifier}`,
                        message: `${capitalize('button')} "${button.name || '(unnamed)'}" is reachable via B key navigation but not in the Tab order. This button may not be keyboard accessible.`,
                        timestamp: button.step.timestamp,
                        context,
                        htmlSnippet: button.htmlSnippet,
                        screenReader: ctx.screenReader,
                    })
                );
            }
        }

        return {
            violations,
            stats: {
                buttonsInBrowseMode: buttons.length,
                buttonsInFocusMode: countByRole(transcript, 'tab', 'button'),
                violationsFound: violations.length,
            },
        };
    }
}

export const rule = new ButtonNotInTabOrderRule();
