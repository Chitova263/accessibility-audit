import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { buildViolation } from '../../rule-catalog';
import { collectHeadings, createHeadingContext } from '../../utils/heading-utils';

interface EmptyHeadingStats {
    totalHeadings: number;
    violationsFound: number;
}

class EmptyHeadingRule implements Rule<ScreenReaderContext, EmptyHeadingStats> {
    readonly id = 'empty-heading';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
        },
        summary: 'Heading has no text content',
    };

    async run(ctx: AuditContext): Promise<RuleResult<ScreenReaderContext, EmptyHeadingStats>> {
        const violations: ScreenReaderViolation[] = [];
        const headings = collectHeadings(ctx);

        for (const heading of headings) {
            if (heading.name.trim() !== '') continue;

            const context = createHeadingContext(heading, ctx.screenReader);

            violations.push(
                buildViolation({
                    ruleId: 'empty-heading',
                    impact: 'serious',
                    stepId: heading.identifier,
                    message: `H${heading.level} heading has no text content. Empty headings confuse screen reader users navigating by heading.`,
                    timestamp: heading.timestamp,
                    context,
                    htmlSnippet: heading.htmlSnippet,
                    screenReader: ctx.screenReader,
                })
            );
        }

        return {
            violations,
            stats: {
                totalHeadings: headings.length,
                violationsFound: violations.length,
            },
        };
    }
}

export const rule = new EmptyHeadingRule();
