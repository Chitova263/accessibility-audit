import type { Rule, RuleMeta, RuleResult } from '../../core/rule';
import type { NvdaContext, NvdaViolation } from '../../core/violation';
import type { AuditContext } from '../../core/context';
import { captureScreenshot } from '../../utils/screenshot-capture';
import { collectHeadings, createHeadingContext, type HeadingInfo } from '../utils/heading-utils';

export interface EmptyHeadingStats {
    totalHeadings: number;
    violationsFound: number;
}

export class EmptyHeadingRule implements Rule<NvdaContext, EmptyHeadingStats> {
    readonly id = 'empty-heading';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
        },
        impact: 'serious',
        summary: 'Heading has no text content',
    };

    async run(ctx: AuditContext): Promise<RuleResult<NvdaContext, EmptyHeadingStats>> {
        const { page, cdp } = ctx;
        const violations: NvdaViolation[] = [];
        const headings = collectHeadings(ctx);

        for (const heading of headings) {
            if (heading.name.trim() !== '') continue;

            const context = createHeadingContext(heading);

            if (typeof heading.backendNodeId === 'number') {
                context.screenshot = (await captureScreenshot(page, cdp, heading.backendNodeId)) ?? undefined;
            }

            violations.push(this.createViolation(heading, context));
        }

        return {
            violations,
            stats: {
                totalHeadings: headings.length,
                violationsFound: violations.length,
            },
        };
    }

    private createViolation(heading: HeadingInfo, context: NvdaContext): NvdaViolation {
        return {
            id: `empty-heading-${heading.identifier}`,
            rule: {
                id: this.id,
                summary: this.meta.summary,
                wcag: this.meta.wcag,
                impact: this.meta.impact,
            },
            message: `H${heading.level} heading has no text content. Empty headings confuse screen reader users navigating by heading.`,
            ...(heading.htmlSnippet != null && { element: { htmlSnippet: heading.htmlSnippet } }),
            tool: 'nvda-audit',
            timestamp: heading.timestamp,
            context,
        };
    }
}

export const rule = new EmptyHeadingRule();
