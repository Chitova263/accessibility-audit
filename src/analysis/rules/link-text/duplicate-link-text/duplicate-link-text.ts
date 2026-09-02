/**
 * Rule: duplicate-link-text
 *
 * Detects when multiple links share the same accessible name but point to
 * different destinations, making it impossible for screen reader users to
 * distinguish them when navigating by links.
 *
 * Maps to WCAG 2.4.4 (Link Purpose in Context), Level A.
 */

import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { captureScreenshotToFile } from '../../../utils/screenshot-capture';
import { getRule } from '../../rule-catalog';
import { collectLinks, createScreenReaderContextFromLink } from '../../utils/link-utils';
import type { LinkInfo } from '../../utils/link-utils';

export interface DuplicateLinkTextStats {
    totalLinks: number;
    violationsFound: number;
    duplicateGroups: number;
}

export class DuplicateLinkTextRule implements Rule<ScreenReaderContext, DuplicateLinkTextStats> {
    readonly id = 'duplicate-link-text';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '2.4.4', level: 'A' },
        },
        impact: 'moderate',
        summary: 'Multiple links with same text but different destinations',
    };

    async run(ctx: AuditContext): Promise<RuleResult<ScreenReaderContext, DuplicateLinkTextStats>> {
        const { transcript, page, cdp, screenshotsDir } = ctx;
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
                if (typeof link.backendNodeId === 'number') {
                    const filename = `${this.id}-${link.identifier}`;
                    context.screenshot = await captureScreenshotToFile(
                        page,
                        cdp,
                        link.backendNodeId,
                        screenshotsDir,
                        filename,
                        { label: `${this.id}: ${this.meta.summary}` }
                    );
                }
                violations.push(this.createViolation(link, group.length, uniqueHrefs.size, context));
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

    private createViolation(
        link: LinkInfo,
        totalCount: number,
        uniqueDestinations: number,
        context: ScreenReaderContext
    ): ScreenReaderViolation {
        return {
            id: `duplicate-link-${link.identifier}`,
            rule: getRule('duplicate-link-text'),
            message: `${totalCount} links share the text "${link.name}" but point to ${uniqueDestinations} different destinations. Links with the same text should go to the same destination, or have unique text.`,
            ...(link.htmlSnippet != null && { element: { htmlSnippet: link.htmlSnippet } }),
            tool: 'screen-reader-audit',
            timestamp: link.timestamp,
            context,
        };
    }
}

function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
    const result: Record<string, T[]> = {};
    for (const item of arr) {
        const key = keyFn(item);
        if (!result[key]) result[key] = [];
        result[key]!.push(item);
    }
    return result;
}

export const rule = new DuplicateLinkTextRule();
