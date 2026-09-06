import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { buildViolation } from '../../rule-catalog';
import { collectHeadings, createHeadingContext } from '../../utils/heading-utils';

interface MissingH1Stats {
    totalHeadings: number;
    h1Count: number;
    violationsFound: number;
}

class MissingH1Rule implements Rule<ScreenReaderContext, MissingH1Stats> {
    readonly id = 'missing-h1';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
        },
        summary: 'Page has no H1 heading',
    };

    async run(ctx: AuditContext): Promise<RuleResult<ScreenReaderContext, MissingH1Stats>> {
        const violations: ScreenReaderViolation[] = [];
        const headings = collectHeadings(ctx);

        const h1Count = headings.filter((h) => h.level === 1).length;

        // Only flag missing H1 when there are other headings present;
        // a completely heading-free page may be appropriate for simple content.
        if (h1Count === 0 && headings.length > 0) {
            const firstHeading = headings[0]!;
            violations.push(
                buildViolation({
                    ruleId: 'missing-h1',
                    impact: 'serious',
                    stepId: firstHeading.identifier,
                    message: `Page has no H1 heading. First heading found is H${firstHeading.level}. Pages should have exactly one H1 that describes the main content.`,
                    timestamp: firstHeading.timestamp,
                    context: createHeadingContext(firstHeading, ctx.screenReader),
                    htmlSnippet: firstHeading.htmlSnippet,
                    screenReader: ctx.screenReader,
                })
            );
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
}

export const rule = new MissingH1Rule();
