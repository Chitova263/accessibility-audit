import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { buildViolation } from '../../rule-catalog';
import { collectLinks, createScreenReaderContextFromLink } from '../../utils/link-utils';

interface DuplicateLinkTextStats {
    totalLinks: number;
    violationsFound: number;
    duplicateGroups: number;
}

class DuplicateLinkTextRule implements Rule<ScreenReaderContext, DuplicateLinkTextStats> {
    readonly id = 'duplicate-link-text';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '2.4.4', level: 'A' },
        },
        summary: 'Multiple links with same text but different destinations',
    };

    async run(ctx: AuditContext): Promise<RuleResult<ScreenReaderContext, DuplicateLinkTextStats>> {
        const { transcript } = ctx;
        const violations: ScreenReaderViolation[] = [];

        const links = collectLinks(transcript);
        const linksByName = groupBy(links, (l) => l.name.trim().toLowerCase());

        let duplicateGroups = 0;

        for (const group of Object.values(linksByName)) {
            if (group.length <= 1) continue;

            const uniqueHrefs = new Set(group.map((l) => l.href).filter(Boolean));
            if (uniqueHrefs.size <= 1) continue;

            duplicateGroups++;

            for (const link of group) {
                const context = createScreenReaderContextFromLink(link, ctx.screenReader);
                violations.push(
                    buildViolation({
                        ruleId: 'duplicate-link-text',
                        impact: 'moderate',
                        stepId: `duplicate-link-${link.identifier}`,
                        message: `${group.length} links share the text "${link.name}" but point to ${uniqueHrefs.size} different destinations. Links with the same text should go to the same destination, or have unique text.`,
                        timestamp: link.timestamp,
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
                totalLinks: links.length,
                violationsFound: violations.length,
                duplicateGroups,
            },
        };
    }
}

function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
    const result: Record<string, T[]> = {};
    for (const item of arr) {
        const key = keyFn(item);
        if (!result[key]) result[key] = [];
        result[key].push(item);
    }
    return result;
}

export const rule = new DuplicateLinkTextRule();
