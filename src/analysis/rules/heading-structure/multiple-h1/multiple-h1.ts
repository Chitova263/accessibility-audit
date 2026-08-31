import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { NvdaContext, NvdaViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { captureScreenshotToFile } from '../../../utils/screenshot-capture';
import { collectHeadings, createHeadingContext, type HeadingInfo } from '../../utils/heading-utils';

export interface MultipleH1Stats {
    totalHeadings: number;
    h1Count: number;
    violationsFound: number;
}

export class MultipleH1Rule implements Rule<NvdaContext, MultipleH1Stats> {
    readonly id = 'multiple-h1';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
        },
        impact: 'moderate',
        summary: 'Page has more than one H1',
    };

    async run(ctx: AuditContext): Promise<RuleResult<NvdaContext, MultipleH1Stats>> {
        const { page, cdp, screenshotsDir } = ctx;
        const violations: NvdaViolation[] = [];
        const headings = collectHeadings(ctx);

        const h1Headings = headings.filter((h) => h.level === 1);

        if (h1Headings.length > 1) {
            for (let i = 1; i < h1Headings.length; i++) {
                const heading = h1Headings[i]!;
                const context = createHeadingContext(heading);

                if (typeof heading.backendNodeId === 'number') {
                    const filename = `${this.id}-${heading.identifier}`;
                    context.screenshot = await captureScreenshotToFile(
                        page,
                        cdp,
                        heading.backendNodeId,
                        screenshotsDir,
                        filename
                    );
                }

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

    private createViolation(heading: HeadingInfo, count: number, context: NvdaContext): NvdaViolation {
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
            tool: 'nvda-audit',
            timestamp: heading.timestamp,
            context,
        };
    }
}

export const rule = new MultipleH1Rule();


