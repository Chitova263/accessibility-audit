/**
 * Rule: generic-link-text
 *
 * Detects links whose accessible name uses a generic phrase like "click here"
 * or "read more" that gives no indication of the link's destination or purpose.
 *
 * Maps to WCAG 2.4.4 (Link Purpose in Context), Level A.
 */

import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { NvdaContext, NvdaViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { captureScreenshotToFile } from '../../../utils/screenshot-capture';
import { getRule } from '../../rule-catalog';
import {
    collectLinks,
    getReadingSteps,
    findSurroundingContext,
    formatSurroundingContext,
    createNvdaContextFromLink,
} from '../../utils/link-utils';
import type { LinkInfo, SurroundingContext } from '../../utils/link-utils';

const GENERIC_LINK_PATTERNS = [
    /^click\s*here$/i,
    /^here$/i,
    /^read\s*more$/i,
    /^more$/i,
    /^learn\s*more$/i,
    /^continue$/i,
    /^continue\s*reading$/i,
    /^details$/i,
    /^link$/i,
    /^info$/i,
    /^information$/i,
    /^go$/i,
    /^download$/i,
    /^view$/i,
    /^view\s*more$/i,
    /^see\s*more$/i,
    /^full\s*story$/i,
    /^mehr$/i, // German "more"
    /^weiterlesen$/i, // German "read more"
    /^hier$/i, // German "here"
];

export interface GenericLinkTextStats {
    totalLinks: number;
    violationsFound: number;
    genericLinksWithSurroundingContext: number;
}

export class GenericLinkTextRule implements Rule<NvdaContext, GenericLinkTextStats> {
    readonly id = 'generic-link-text';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '2.4.4', level: 'A' },
        },
        impact: 'serious',
        summary: 'Link uses generic text like "click here" or "read more"',
    };

    async run(ctx: AuditContext): Promise<RuleResult<NvdaContext, GenericLinkTextStats>> {
        const { transcript, page, cdp, screenshotsDir } = ctx;
        const violations: NvdaViolation[] = [];
        let genericLinksWithSurroundingContext = 0;

        const links = collectLinks(transcript);
        const readingSteps = getReadingSteps(transcript);

        for (const link of links) {
            if (!isGenericLinkText(link.name.trim())) continue;

            const surroundingContext = findSurroundingContext(readingSteps, link.backendNodeId);
            if (surroundingContext) genericLinksWithSurroundingContext++;

            const context = createNvdaContextFromLink(link);
            if (typeof link.backendNodeId === 'number') {
                const filename = `${this.id}-${link.identifier}`;
                context.screenshot = await captureScreenshotToFile(
                    page,
                    cdp,
                    link.backendNodeId,
                    screenshotsDir,
                    filename
                );
            }

            violations.push(this.createViolation(link, surroundingContext, context));
        }

        return {
            violations,
            stats: {
                totalLinks: links.length,
                violationsFound: violations.length,
                genericLinksWithSurroundingContext,
            },
        };
    }

    private createViolation(
        link: LinkInfo,
        surroundingContext: SurroundingContext | null,
        context: NvdaContext
    ): NvdaViolation {
        const base = `Link has generic text "${link.name}". Link text should describe the destination or purpose, not use generic phrases like "click here" or "read more".`;

        const message = surroundingContext
            ? `${base} Read linearly, it is surrounded by: ${formatSurroundingContext(surroundingContext)}. Check whether that text makes the destination clear.`
            : `${base} Read linearly, it has no surrounding text to explain where it goes.`;

        return {
            id: `generic-link-${link.identifier}`,
            rule: getRule('generic-link-text', surroundingContext ? 'moderate' : 'serious'),
            message,
            ...(link.htmlSnippet != null && { element: { htmlSnippet: link.htmlSnippet } }),
            tool: 'nvda-audit',
            timestamp: link.timestamp,
            context,
        };
    }
}

function isGenericLinkText(text: string): boolean {
    return GENERIC_LINK_PATTERNS.some((pattern) => pattern.test(text));
}

export const rule = new GenericLinkTextRule();
