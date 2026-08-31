import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { NvdaContext, NvdaViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { captureScreenshotToFile } from '../../../utils/screenshot-capture';
import { collectHeadings, createHeadingContext, type HeadingInfo } from '../../utils/heading-utils';

export interface HeadingLevelSkippedStats {
    totalHeadings: number;
    headingSequence: number[];
    violationsFound: number;
}

export class HeadingLevelSkippedRule implements Rule<NvdaContext, HeadingLevelSkippedStats> {
    readonly id = 'heading-level-skipped';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
        },
        impact: 'moderate',
        summary: 'Heading levels are skipped (e.g., H1 to H3)',
    };

    async run(ctx: AuditContext): Promise<RuleResult<NvdaContext, HeadingLevelSkippedStats>> {
        const { page, cdp, screenshotsDir } = ctx;
        const violations: NvdaViolation[] = [];
        const headings = collectHeadings(ctx);

        let previousLevel = 0;

        for (const heading of headings) {
            if (previousLevel > 0 && heading.level > previousLevel + 1) {
                const context = createHeadingContext(heading);

                if (typeof heading.backendNodeId === 'number') {
                    const filename = `${this.id}-${heading.identifier}`;
                    context.screenshot = await captureScreenshotToFile(
                        page,
                        cdp,
                        heading.backendNodeId,
                        screenshotsDir,
                        filename,
                        { label: `${this.id}: ${this.meta.summary}` }
                    );
                }

                violations.push(this.createViolation(heading, previousLevel, context));
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

    private createViolation(heading: HeadingInfo, previousLevel: number, context: NvdaContext): NvdaViolation {
        return {
            id: `skipped-level-${heading.identifier}`,
            rule: {
                id: this.id,
                summary: this.meta.summary,
                wcag: this.meta.wcag,
                impact: this.meta.impact,
            },
            message: `Heading level skipped: H${previousLevel} → H${heading.level}. Expected H${previousLevel + 1}. Skipping heading levels breaks the document outline for screen reader users.`,
            ...(heading.htmlSnippet != null && { element: { htmlSnippet: heading.htmlSnippet } }),
            tool: 'nvda-audit',
            timestamp: heading.timestamp,
            context,
        };
    }
}

export const rule = new HeadingLevelSkippedRule();
