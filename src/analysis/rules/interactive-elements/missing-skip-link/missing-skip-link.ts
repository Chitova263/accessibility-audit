/**
 * Rule: Missing Skip Link
 *
 * Detects whether the page has a skip link (skip to main content)
 * that appears early in the tab order.
 *
 * Skip links help keyboard users bypass repetitive navigation
 * and jump directly to main content.
 *
 * Maps to WCAG 2.4.1 (Bypass Blocks).
 */

import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { NvdaContext, NvdaViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { createNvdaContext } from '../../../utils/tool-details';

/** How many tab stops to check for skip link */
const MAX_TAB_STOPS_TO_CHECK = 5;

/** Patterns that indicate a skip link (case-insensitive) */
const SKIP_LINK_NAME_PATTERNS = [
    /skip/i,
    /jump\s*to/i,
    /go\s*to\s*(main|content)/i,
    /direkt\s*zu/i, // German
    /zum\s*(inhalt|hauptinhalt)/i, // German
    /aller\s*au\s*contenu/i, // French
    /passer/i, // French
];

/** Patterns in href that indicate skip link target */
const SKIP_LINK_HREF_PATTERNS = [
    /#main/i,
    /#content/i,
    /#skip/i,
    /#primary/i,
    /#maincontent/i,
    /#main-content/i,
    /#body/i,
    /#inhalt/i, // German
    /#contenu/i, // French
];

export interface MissingSkipLinkStats {
    skipLinkFound: boolean;
    skipLinkPosition: number | null;
    firstFewTabStops: string[];
}

export class MissingSkipLinkRule implements Rule<NvdaContext, MissingSkipLinkStats> {
    readonly id = 'missing-skip-link';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '2.4.1', level: 'A' },
        },
        impact: 'serious',
        summary: 'No skip link found in the first tab stops',
    };

    async run(ctx: AuditContext): Promise<RuleResult<NvdaContext, MissingSkipLinkStats>> {
        const { transcript } = ctx;
        const violations: NvdaViolation[] = [];
        let skipLinkFound = false;
        let skipLinkPosition: number | null = null;
        const firstFewTabStops: string[] = [];

        for (const result of transcript) {
            const strategyType = result.meta.type ?? result.meta.name;

            if (strategyType !== 'tab') continue;

            const stepsToCheck = Math.min(result.navigationSteps.length, MAX_TAB_STOPS_TO_CHECK);

            for (let i = 0; i < stepsToCheck; i++) {
                const step = result.navigationSteps[i]!;
                const node = step.axNode;
                const name = node?.name?.value ?? step.itemText ?? '';
                const htmlSnippet = step.htmlSnippet ?? '';

                firstFewTabStops.push(name || `(${node?.role?.value ?? 'unknown'})`);

                if (this.isSkipLink(name, htmlSnippet)) {
                    skipLinkFound = true;
                    skipLinkPosition = i + 1;
                    break;
                }
            }

            if (result.navigationSteps.length > 0 && !skipLinkFound) {
                const firstStep = result.navigationSteps[0]!;
                violations.push(this.createViolation(firstStep, firstFewTabStops));
            }

            break;
        }

        return {
            violations,
            stats: {
                skipLinkFound,
                skipLinkPosition,
                firstFewTabStops,
            },
        };
    }

    private isSkipLink(name: string, htmlSnippet: string): boolean {
        if (SKIP_LINK_NAME_PATTERNS.some((pattern) => pattern.test(name))) return true;
        if (SKIP_LINK_HREF_PATTERNS.some((pattern) => pattern.test(htmlSnippet))) return true;
        return false;
    }

    private createViolation(
        firstStep: {
            identifier: string;
            spokenPhrases: string[];
            itemText: string;
            timestamp: number;
            htmlSnippet: string | null;
            axNode: unknown;
        },
        firstFewTabStops: string[]
    ): NvdaViolation {
        const context = createNvdaContext(firstStep, 'tab', 0);

        return {
            id: `missing-skip-link-${firstStep.identifier}`,
            rule: {
                id: this.id,
                summary: this.meta.summary,
                wcag: this.meta.wcag,
                impact: this.meta.impact,
            },
            message: `No skip link found in the first ${MAX_TAB_STOPS_TO_CHECK} tab stops. Skip links help keyboard users bypass navigation and jump to main content. First tab stops: ${firstFewTabStops.join(', ')}.`,
            element: {},
            tool: 'nvda-audit',
            timestamp: firstStep.timestamp,
            context,
        };
    }
}

export const rule = new MissingSkipLinkRule();


