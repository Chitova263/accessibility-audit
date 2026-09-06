import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { buildViolation } from '../../rule-catalog';
import {
    collectLinks,
    getReadingSteps,
    findSurroundingContext,
    formatSurroundingContext,
    createScreenReaderContextFromLink,
} from '../../utils/link-utils';

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

interface GenericLinkTextStats {
    totalLinks: number;
    violationsFound: number;
    genericLinksWithSurroundingContext: number;
}

class GenericLinkTextRule implements Rule<ScreenReaderContext, GenericLinkTextStats> {
    readonly id = 'generic-link-text';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '2.4.4', level: 'A' },
        },
        summary: 'Link uses generic text like "click here" or "read more"',
    };

    async run(ctx: AuditContext): Promise<RuleResult<ScreenReaderContext, GenericLinkTextStats>> {
        const { transcript } = ctx;
        const violations: ScreenReaderViolation[] = [];
        let genericLinksWithSurroundingContext = 0;

        const links = collectLinks(transcript);
        const readingSteps = getReadingSteps(transcript);

        for (const link of links) {
            if (!isGenericLinkText(link.name.trim())) continue;

            const surroundingContext = findSurroundingContext(readingSteps, link.backendNodeId);
            if (surroundingContext) genericLinksWithSurroundingContext++;

            const context = createScreenReaderContextFromLink(link, ctx.screenReader);

            const base = `Link has generic text "${link.name}". Link text should describe the destination or purpose, not use generic phrases like "click here" or "read more".`;
            const message = surroundingContext
                ? `${base} Read linearly, it is surrounded by: ${formatSurroundingContext(surroundingContext)}. Check whether that text makes the destination clear.`
                : `${base} Read linearly, it has no surrounding text to explain where it goes.`;

            violations.push(
                buildViolation({
                    ruleId: 'generic-link-text',
                    impact: surroundingContext ? 'moderate' : 'serious',
                    stepId: `generic-link-${link.identifier}`,
                    message,
                    timestamp: link.timestamp,
                    context,
                    htmlSnippet: link.htmlSnippet,
                    screenReader: ctx.screenReader,
                })
            );
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
}

function isGenericLinkText(text: string): boolean {
    return GENERIC_LINK_PATTERNS.some((pattern) => pattern.test(text));
}

export const rule = new GenericLinkTextRule();
