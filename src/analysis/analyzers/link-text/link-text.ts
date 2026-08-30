/**
 * Analyzer: Link Text Quality
 *
 * Detects link text issues:
 * - Generic link text ("click here", "read more", etc.)
 * - Duplicate link text pointing to different destinations
 *
 * Maps to WCAG 2.4.4 (Link Purpose in Context).
 */

import type {
    StrategyResult,
    NavigationStep,
} from '../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import type { NvdaViolation, NvdaContext } from '../../core/violation';
import type { AuditContext } from '../../core/context';
import { createNvdaContext } from '../../utils/tool-details';
import { getRule } from '../../registry/rule-catalog';
import { captureScreenshot } from '../../utils/screenshot-capture';

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

/** Roles that carry their own purpose and so do not count as context for a link */
const INTERACTIVE_ROLES = ['button', 'link', 'menuitem', 'tab', 'checkbox', 'radio', 'switch', 'textbox', 'combobox'];

/** How many reading-order steps either side of a link count as its context */
const CONTEXT_WINDOW = 2;

/** Announcements this short are punctuation or list markers rather than context */
const MIN_CONTEXT_TEXT_LENGTH = 3;

export interface LinkTextAnalyzerResult {
    violations: NvdaViolation[];
    summary: {
        totalLinks: number;
        violationsFound: number;
        byIssue: Record<LinkIssue, number>;
        genericLinksWithSurroundingContext: number;
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
    backendNodeId: number | null;
}

/** Text read out immediately before and after a link during linear reading */
interface SurroundingContext {
    before: string[];
    after: string[];
}

export async function analyzeLinkText(ctx: AuditContext): Promise<LinkTextAnalyzerResult> {
    const { transcript, page, cdp } = ctx;
    const violations: NvdaViolation[] = [];
    const byIssue: Record<LinkIssue, number> = {
        'generic-link-text': 0,
        'duplicate-link-text': 0,
    };
    let genericLinksWithSurroundingContext = 0;

    const readingSteps = getReadingSteps(transcript);

    // Collect all links from link strategy
    const links: LinkInfo[] = [];

    for (const result of transcript) {
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
                backendNodeId: node.backendDOMNodeId ?? null,
            });
        }
    }

    // Check: Generic link text
    for (const link of links) {
        const normalizedName = link.name.trim();

        if (isGenericLinkText(normalizedName)) {
            byIssue['generic-link-text']++;
            const surroundingContext = findSurroundingContext(readingSteps, link.backendNodeId);
            if (surroundingContext) genericLinksWithSurroundingContext++;

            const context = createNvdaContextFromLink(link);
            if (typeof link.backendNodeId === 'number') {
                context.screenshot = (await captureScreenshot(page, cdp, link.backendNodeId)) ?? undefined;
            }
            violations.push(createGenericLinkViolation(link, surroundingContext, context));
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
                const context = createNvdaContextFromLink(link);
                if (typeof link.backendNodeId === 'number') {
                    context.screenshot = (await captureScreenshot(page, cdp, link.backendNodeId)) ?? undefined;
                }
                violations.push(createDuplicateLinkViolation(link, group.length, uniqueHrefs.size, context));
            }
        }
    }

    return {
        violations,
        summary: {
            totalLinks: links.length,
            violationsFound: violations.length,
            byIssue,
            genericLinksWithSurroundingContext,
        },
    };
}

function isGenericLinkText(text: string): boolean {
    return GENERIC_LINK_PATTERNS.some((pattern) => pattern.test(text));
}

function getReadingSteps(transcript: StrategyResult[]): NavigationStep[] {
    return transcript.find((r) => r.meta.type === 'arrow')?.navigationSteps ?? [];
}

function findSurroundingContext(
    readingSteps: NavigationStep[],
    backendNodeId: number | null
): SurroundingContext | null {
    if (backendNodeId == null || readingSteps.length === 0) return null;

    const position = readingSteps.findIndex((step) => step.axNode?.backendDOMNodeId === backendNodeId);
    if (position === -1) return null;

    const before = collectContextText(readingSteps, Math.max(0, position - CONTEXT_WINDOW), position);
    const after = collectContextText(
        readingSteps,
        position + 1,
        Math.min(readingSteps.length, position + 1 + CONTEXT_WINDOW)
    );

    if (before.length === 0 && after.length === 0) return null;

    return { before, after };
}

function collectContextText(readingSteps: NavigationStep[], start: number, end: number): string[] {
    const texts: string[] = [];

    for (let i = start; i < end; i++) {
        const step = readingSteps[i]!;
        const role = step.axNode?.role?.value;

        if (role && INTERACTIVE_ROLES.includes(role)) continue;

        const text = step.itemText.trim();
        if (text.length > MIN_CONTEXT_TEXT_LENGTH) {
            texts.push(text);
        }
    }

    return texts;
}

function extractHref(htmlSnippet: string | null): string | null {
    if (!htmlSnippet) return null;

    const match = htmlSnippet.match(/href\s*=\s*["']([^"']*)["']/i);
    return match?.[1] ?? null;
}

function formatContext(context: SurroundingContext): string {
    const parts: string[] = [];
    if (context.before.length > 0) parts.push(`before "${context.before.join(' / ')}"`);
    if (context.after.length > 0) parts.push(`after "${context.after.join(' / ')}"`);
    return parts.join(', ');
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

function createNvdaContextFromLink(link: LinkInfo): NvdaContext {
    return createNvdaContext(
        {
            identifier: link.identifier,
            spokenPhrases: link.spokenPhrases,
            itemText: link.itemText,
            axNode: link.axNode,
        },
        'link',
        link.stepIndex
    );
}

function createGenericLinkViolation(
    link: LinkInfo,
    surroundingContext: SurroundingContext | null,
    context: NvdaContext
): NvdaViolation {
    const base = `Link has generic text "${link.name}". Link text should describe the destination or purpose, not use generic phrases like "click here" or "read more".`;

    const message = surroundingContext
        ? `${base} Read linearly, it is surrounded by: ${formatContext(surroundingContext)}. Check whether that text makes the destination clear.`
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

function createDuplicateLinkViolation(
    link: LinkInfo,
    totalCount: number,
    uniqueDestinations: number,
    context: NvdaContext
): NvdaViolation {
    return {
        id: `duplicate-link-${link.identifier}`,
        rule: getRule('duplicate-link-text'),
        message: `${totalCount} links share the text "${link.name}" but point to ${uniqueDestinations} different destinations. Links with the same text should go to the same destination, or have unique text.`,
        ...(link.htmlSnippet != null && { element: { htmlSnippet: link.htmlSnippet } }),
        tool: 'nvda-audit',
        timestamp: link.timestamp,
        context,
    };
}
