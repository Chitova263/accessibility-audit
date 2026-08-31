import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { NvdaContext, NvdaViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { collectHeadings, createHeadingContext, type HeadingInfo } from '../../utils/heading-utils';

export interface MissingH1Stats {
    totalHeadings: number;
    h1Count: number;
    violationsFound: number;
}

export class MissingH1Rule implements Rule<NvdaContext, MissingH1Stats> {
    readonly id = 'missing-h1';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
        },
        impact: 'serious',
        summary: 'Page has no H1 heading',
    };

    async run(ctx: AuditContext): Promise<RuleResult<NvdaContext, MissingH1Stats>> {
        const violations: NvdaViolation[] = [];
        const headings = collectHeadings(ctx);

        const h1Count = headings.filter((h) => h.level === 1).length;

        // Only flag missing H1 when there are other headings present;
        // a completely heading-free page may be appropriate for simple content.
        if (h1Count === 0 && headings.length > 0) {
            violations.push(this.createViolation(headings[0]!));
        }

        return {
            violations,
            stats: {
                totalHeadings: headings.length,
                h1Count,
                violationsFound: violations.length,
            },
        };
    }

    private createViolation(firstHeading: HeadingInfo): NvdaViolation {
        return {
            id: `missing-h1-${firstHeading.identifier}`,
            rule: {
                id: this.id,
                summary: this.meta.summary,
                wcag: this.meta.wcag,
                impact: this.meta.impact,
            },
            message: `Page has no H1 heading. First heading found is H${firstHeading.level}. Pages should have exactly one H1 that describes the main content.`,
            ...(firstHeading.htmlSnippet != null && { element: { htmlSnippet: firstHeading.htmlSnippet } }),
            tool: 'nvda-audit',
            timestamp: firstHeading.timestamp,
            context: createHeadingContext(firstHeading),
        };
    }
}

export const rule = new MissingH1Rule();


