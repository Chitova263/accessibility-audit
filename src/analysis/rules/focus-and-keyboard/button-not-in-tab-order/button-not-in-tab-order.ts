import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { createScreenReaderContext } from '../../../utils/tool-details';
import { captureScreenshotToFile } from '../../../utils/screenshot-capture';
import { capitalize } from '../../../utils/string-utils';
import {
    collectElementsByStrategy,
    countByRole,
    createSignature,
    isLikelyInTabOrder,
    type ElementSignature,
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
        impact: 'serious',
        summary: 'Button reachable via B key but not Tab',
    };

    async run(ctx: AuditContext): Promise<RuleResult<ScreenReaderContext, ButtonNotInTabOrderStats>> {
        const { transcript, page, cdp, screenshotsDir } = ctx;
        const violations: ScreenReaderViolation[] = [];

        const { elements: buttons, tabOrderSignatures } = collectElementsByStrategy(transcript, 'button', 'button');

        for (const button of buttons) {
            const signature = createSignature(button.step);

            if (!tabOrderSignatures.has(signature) && !isLikelyInTabOrder(button, tabOrderSignatures)) {
                const context = createScreenReaderContext(button.step, button.strategyType, 0, ctx.screenReader);

                if (typeof button.backendNodeId === 'number') {
                    const filename = `${this.id}-${button.step.identifier}`;
                    context.screenshot = await captureScreenshotToFile(
                        page,
                        cdp,
                        button.backendNodeId,
                        screenshotsDir,
                        filename,
                        { label: `${this.id}: ${this.meta.summary}` }
                    );
                }

                violations.push(this.createViolation(button, context));
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

    private createViolation(button: ElementSignature, context: ScreenReaderContext): ScreenReaderViolation {
        return {
            id: `${this.id}-${button.step.identifier}`,
            rule: {
                id: this.id,
                summary: this.meta.summary,
                wcag: this.meta.wcag,
                impact: this.meta.impact,
            },
            message: `${capitalize('button')} "${button.name || '(unnamed)'}" is reachable via B key navigation but not in the Tab order. This button may not be keyboard accessible.`,
            ...(button.htmlSnippet != null ? { element: { htmlSnippet: button.htmlSnippet } } : {}),
            tool: 'nvda-audit',
            timestamp: button.step.timestamp,
            context,
        };
    }
}

export const rule = new ButtonNotInTabOrderRule();
