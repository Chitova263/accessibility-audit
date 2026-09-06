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

interface LinkNotInTabOrderStats {
    linksInBrowseMode: number;
    linksInFocusMode: number;
    violationsFound: number;
}

class LinkNotInTabOrderRule implements Rule<ScreenReaderContext, LinkNotInTabOrderStats> {
    readonly id = 'link-not-in-tab-order';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '2.1.1', level: 'A' },
        },
        summary: 'Link reachable via K key but not Tab',
    };

    async run(ctx: AuditContext): Promise<RuleResult<ScreenReaderContext, LinkNotInTabOrderStats>> {
        const { transcript } = ctx;
        const violations: ScreenReaderViolation[] = [];

        const { elements: links, tabOrderSignatures } = collectElementsByStrategy(transcript, 'link', 'link');

        for (const link of links) {
            const signature = createSignature(link.step);

            if (!tabOrderSignatures.has(signature) && !isLikelyInTabOrder(link, tabOrderSignatures)) {
                const context = createScreenReaderContext(link.step, link.strategyType, 0, ctx.screenReader);

                violations.push(
                    buildViolation({
                        ruleId: 'link-not-in-tab-order',
                        impact: 'serious',
                        stepId: `${this.id}-${link.step.identifier}`,
                        message: `${capitalize('link')} "${link.name || '(unnamed)'}" is reachable via K key navigation but not in the Tab order. This link may not be keyboard accessible.`,
                        timestamp: link.step.timestamp,
                        context,
                        htmlSnippet: link.htmlSnippet,
                        screenReader: ctx.screenReader,
                    })
                );
            }
        }

        return {
            violations,
            stats: {
                linksInBrowseMode: links.length,
                linksInFocusMode: countByRole(transcript, 'tab', 'link'),
                violationsFound: violations.length,
            },
        };
    }
}

export const rule = new LinkNotInTabOrderRule();
