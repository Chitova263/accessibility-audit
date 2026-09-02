import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { collectHeadings, createHeadingContext, type HeadingInfo } from '../../utils/heading-utils';
import type { ScreenReaderName } from '../../../../screen-reader/drivers/types';

export interface MissingH1Stats {
    totalHeadings: number;
    h1Count: number;
    violationsFound: number;
}

export class MissingH1Rule implements Rule<ScreenReaderContext, MissingH1Stats> {
    readonly id = 'missing-h1';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
        },
        impact: 'serious',
        summary: 'Page has no H1 heading',
    };

    async run(ctx: AuditContext): Promise<RuleResult<ScreenReaderContext, MissingH1Stats>> {
        const violations: ScreenReaderViolation[] = [];
        const headings = collectHeadings(ctx);

        const h1Count = headings.filter((h) => h.level === 1).length;

        // Only flag missing H1 when there are other headings present;
        // a completely heading-free page may be appropriate for simple content.
        if (h1Count === 0 && headings.length > 0) {
            violations.push(this.createViolation(headings[0]!, ctx.screenReader));
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

    private createViolation(firstHeading: HeadingInfo, screenReader: ScreenReaderName): ScreenReaderViolation {
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
            tool: 'screen-reader-audit',
            timestamp: firstHeading.timestamp,
            context: createHeadingContext(firstHeading, screenReader),
        };
    }
}

export const rule = new MissingH1Rule();
