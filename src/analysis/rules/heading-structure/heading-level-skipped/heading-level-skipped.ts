import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { buildViolation } from '../../rule-catalog';
import { collectHeadings, createHeadingContext } from '../../utils/heading-utils';

interface HeadingLevelSkippedStats {
    totalHeadings: number;
    headingSequence: number[];
    violationsFound: number;
}

class HeadingLevelSkippedRule implements Rule<ScreenReaderContext, HeadingLevelSkippedStats> {
    readonly id = 'heading-level-skipped';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
        },
        summary: 'Heading levels are skipped (e.g., H1 to H3)',
    };

    async run(ctx: AuditContext): Promise<RuleResult<ScreenReaderContext, HeadingLevelSkippedStats>> {
        const violations: ScreenReaderViolation[] = [];
        const headings = collectHeadings(ctx);

        let previousLevel = 0;

        for (const heading of headings) {
            if (previousLevel > 0 && heading.level > previousLevel + 1) {
                const context = createHeadingContext(heading, ctx.screenReader);

                violations.push(
                    buildViolation({
                        ruleId: 'heading-level-skipped',
                        impact: 'moderate',
                        stepId: `skipped-level-${heading.identifier}`,
                        message: `Heading level skipped: H${previousLevel} → H${heading.level}. Expected H${previousLevel + 1}. Skipping heading levels breaks the document outline for screen reader users.`,
                        timestamp: heading.timestamp,
                        context,
                        htmlSnippet: heading.htmlSnippet,
                        screenReader: ctx.screenReader,
                    })
                );
            }

            previousLevel = heading.level;
        }

        return {
            violations,
            stats: {
                totalHeadings: headings.length,
                headingSequence: headings.map((h) => h.level),
                violationsFound: violations.length,
            },
        };
    }
}

export const rule = new HeadingLevelSkippedRule();
