import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { collectHeadings, createHeadingContext, type HeadingInfo } from '../../utils/heading-utils';

export interface MultipleH1Stats {
    totalHeadings: number;
    h1Count: number;
    violationsFound: number;
}

export class MultipleH1Rule implements Rule<ScreenReaderContext, MultipleH1Stats> {
    readonly id = 'multiple-h1';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
        },
        impact: 'moderate',
        summary: 'Page has more than one H1',
    };

    async run(ctx: AuditContext): Promise<RuleResult<ScreenReaderContext, MultipleH1Stats>> {
        const violations: ScreenReaderViolation[] = [];
        const headings = collectHeadings(ctx);

        const h1Headings = headings.filter((h) => h.level === 1);

        if (h1Headings.length > 1) {
            for (let i = 1; i < h1Headings.length; i++) {
                const heading = h1Headings[i]!;
                const context = createHeadingContext(heading, ctx.screenReader);

                violations.push(this.createViolation(heading, i + 1, context));
            }
        }

        return {
            violations,
            stats: {
                totalHeadings: headings.length,
                h1Count: h1Headings.length,
                violationsFound: violations.length,
            },
        };
    }

    private createViolation(heading: HeadingInfo, count: number, context: ScreenReaderContext): ScreenReaderViolation {
        return {
            id: `multiple-h1-${heading.identifier}`,
            rule: {
                id: this.id,
                summary: this.meta.summary,
                wcag: this.meta.wcag,
                impact: this.meta.impact,
            },
            message: `Multiple H1 headings found (this is H1 #${count}). Pages should have exactly one H1 that describes the main content.`,
            ...(heading.htmlSnippet != null && { element: { htmlSnippet: heading.htmlSnippet } }),
            tool: 'screen-reader-audit',
            timestamp: heading.timestamp,
            context,
        };
    }
}

export const rule = new MultipleH1Rule();
