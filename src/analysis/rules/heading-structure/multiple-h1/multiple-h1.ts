import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { buildViolation } from '../../rule-catalog';
import { collectHeadings, createHeadingContext } from '../../utils/heading-utils';

interface MultipleH1Stats {
    totalHeadings: number;
    h1Count: number;
    violationsFound: number;
}

class MultipleH1Rule implements Rule<ScreenReaderContext, MultipleH1Stats> {
    readonly id = 'multiple-h1';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
        },
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

                violations.push(
                    buildViolation({
                        ruleId: 'multiple-h1',
                        impact: 'moderate',
                        stepId: heading.identifier,
                        message: `Multiple H1 headings found (this is H1 #${i + 1}). Pages should have exactly one H1 that describes the main content.`,
                        timestamp: heading.timestamp,
                        context,
                        htmlSnippet: heading.htmlSnippet,
                        screenReader: ctx.screenReader,
                    })
                );
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
}

export const rule = new MultipleH1Rule();
