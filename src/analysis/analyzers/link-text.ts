/**
 * Analyzer: Link Text Quality
 *
 * Detects link text issues:
 * - Generic link text ("click here", "read more", etc.)
 * - Duplicate link text pointing to different destinations
 *
 * Maps to WCAG 2.4.4 (Link Purpose in Context).
 */

import type { StrategyResult } from '../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import type { NvdaViolation, NvdaToolDetails } from '../violation';

type LinkIssue = 'generic-link-text' | 'duplicate-link-text';

/** Common generic link text patterns (case-insensitive) */
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

export interface LinkTextAnalyzerResult {
    violations: NvdaViolation[];
    summary: {
        totalLinks: number;
        violationsFound: number;
        byIssue: Record<LinkIssue, number>;
    };
}

interface LinkInfo {
    name: string;
    href: string | null;
    stepIndex: number;
    htmlSnippet: string | null;
    spokenPhrases: string[];
    itemText: string;
    identifier: string;
    timestamp: number;
    axNode: unknown;
}

export function analyzeLinkText(strategyResults: StrategyResult[]): LinkTextAnalyzerResult {
    const violations: NvdaViolation[] = [];
    const byIssue: Record<LinkIssue, number> = {
        'generic-link-text': 0,
        'duplicate-link-text': 0,
    };

    // Collect all links from link strategy
    const links: LinkInfo[] = [];

    for (const result of strategyResults) {
        const strategyType = result.meta.type ?? result.meta.name;

        if (strategyType !== 'link') continue;

        for (let stepIndex = 0; stepIndex < result.navigationSteps.length; stepIndex++) {
            const step = result.navigationSteps[stepIndex]!;
            const node = step.axNode;

            if (!node || node.role?.value !== 'link') continue;

            const name = node.name?.value ?? '';
            const href = extractHref(step.htmlSnippet);

            links.push({
                name,
                href,
                stepIndex,
                htmlSnippet: step.htmlSnippet,
                spokenPhrases: step.spokenPhrases,
                itemText: step.itemText,
                identifier: step.identifier,
                timestamp: step.timestamp,
                axNode: node,
            });
        }
    }

    // Check: Generic link text
    for (const link of links) {
        const normalizedName = link.name.trim();

        if (isGenericLinkText(normalizedName)) {
            byIssue['generic-link-text']++;
            violations.push(createGenericLinkViolation(link));
        }
    }

    // Check: Duplicate link text with different destinations
    const linksByName = groupBy(links, (l) => l.name.trim().toLowerCase());

    for (const [, group] of Object.entries(linksByName)) {
        if (group.length <= 1) continue;

        // Get unique hrefs in this group
        const uniqueHrefs = new Set(group.map((l) => l.href).filter(Boolean));

        if (uniqueHrefs.size > 1) {
            // Multiple links with same text but different destinations
            for (const link of group) {
                byIssue['duplicate-link-text']++;
                violations.push(createDuplicateLinkViolation(link, group.length, uniqueHrefs.size));
            }
        }
    }

    return {
        violations,
        summary: {
            totalLinks: links.length,
            violationsFound: violations.length,
            byIssue,
        },
    };
}

function isGenericLinkText(text: string): boolean {
    return GENERIC_LINK_PATTERNS.some((pattern) => pattern.test(text));
}

function extractHref(htmlSnippet: string | null): string | null {
    if (!htmlSnippet) return null;

    const match = htmlSnippet.match(/href\s*=\s*["']([^"']*)["']/i);
    return match?.[1] ?? null;
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

function createToolDetails(link: LinkInfo): NvdaToolDetails {
    return {
        spokenPhrases: link.spokenPhrases,
        itemText: link.itemText,
        navigationStrategy: 'link',
        stepIndex: link.stepIndex,
        axNode: link.axNode as NvdaToolDetails['axNode'],
    };
}

function createGenericLinkViolation(link: LinkInfo): NvdaViolation {
    return {
        id: `generic-link-${link.identifier}`,
        ruleId: 'generic-link-text',
        wcag: {
            primary: { criterion: '2.4.4', level: 'A' },
        },
        impact: 'serious',
        message: `Link has generic text "${link.name}". Link text should describe the destination or purpose, not use generic phrases like "click here" or "read more".`,
        element: {
            htmlSnippet: link.htmlSnippet ?? undefined,
        },
        tool: 'nvda-audit',
        timestamp: link.timestamp,
        toolDetails: createToolDetails(link),
    };
}

function createDuplicateLinkViolation(link: LinkInfo, totalCount: number, uniqueDestinations: number): NvdaViolation {
    return {
        id: `duplicate-link-${link.identifier}`,
        ruleId: 'duplicate-link-text',
        wcag: {
            primary: { criterion: '2.4.4', level: 'A' },
        },
        impact: 'moderate',
        message: `${totalCount} links share the text "${link.name}" but point to ${uniqueDestinations} different destinations. Links with the same text should go to the same destination, or have unique text.`,
        element: {
            htmlSnippet: link.htmlSnippet ?? undefined,
        },
        tool: 'nvda-audit',
        timestamp: link.timestamp,
        toolDetails: createToolDetails(link),
    };
}
