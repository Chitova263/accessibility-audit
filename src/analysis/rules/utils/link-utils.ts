/**
 * Shared helpers for link-related rule classes.
 *
 * Provides link collection from the transcript and surrounding-context
 * extraction used by both GenericLinkTextRule and DuplicateLinkTextRule.
 */

import type { StrategyResult, NavigationStep } from '../../../screen-reader/strategies/navigation-strategy';
import { createScreenReaderContext } from '../../utils/tool-details';
import type { ScreenReaderContext } from '../../core/violation';
import type { AXNode } from '../../../types/cdp';
import { getRole, getName } from '../../../types/ax-utils';

/** Roles that carry their own purpose and do not count as context for a link */
const INTERACTIVE_ROLES = ['button', 'link', 'menuitem', 'tab', 'checkbox', 'radio', 'switch', 'textbox', 'combobox'];

/** How many reading-order steps either side of a link count as its context */
const CONTEXT_WINDOW = 2;

/** Announcements this short are punctuation or list markers rather than context */
const MIN_CONTEXT_TEXT_LENGTH = 3;

export interface LinkInfo {
    name: string;
    href: string | null;
    stepIndex: number;
    htmlSnippet: string | null;
    spokenPhrases: string[];
    focusedElementText: string;
    identifier: string;
    timestamp: number;
    axNode: AXNode | undefined;
    backendNodeId: number | null;
}

/** Text read out immediately before and after a link during linear reading */
export interface SurroundingContext {
    before: string[];
    after: string[];
}

/**
 * Collects all links from the `link` navigation strategy in the transcript.
 */
export function collectLinks(transcript: StrategyResult[]): LinkInfo[] {
    const links: LinkInfo[] = [];

    for (const result of transcript) {
        const strategyType = result.meta.name;

        if (strategyType !== 'link') continue;

        for (let stepIndex = 0; stepIndex < result.navigationSteps.length; stepIndex++) {
            const step = result.navigationSteps[stepIndex]!;
            const node = step.axNode;

            if (!node || getRole(node) !== 'link') continue;

            links.push({
                name: getName(node) ?? '',
                href: extractHref(step.htmlSnippet),
                stepIndex,
                htmlSnippet: step.htmlSnippet,
                spokenPhrases: step.spokenPhrases,
                focusedElementText: step.focusedElementText,
                identifier: step.identifier,
                timestamp: step.timestamp,
                axNode: node,
                backendNodeId: node.backendDOMNodeId ?? null,
            });
        }
    }

    return links;
}

/**
 * Returns the arrow-strategy steps from the transcript, which represent
 * the linear reading order used to build surrounding context.
 */
export function getReadingSteps(transcript: StrategyResult[]): NavigationStep[] {
    return transcript.find((r) => r.meta.name === 'arrow')?.navigationSteps ?? [];
}

/**
 * Finds the text spoken immediately before and after `backendNodeId` in the
 * linear reading order. Returns `null` when no context is available.
 */
export function findSurroundingContext(
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

/**
 * Formats a `SurroundingContext` into a human-readable string for violation
 * messages, e.g. `before "Subscription plans", after "Sign up today"`.
 */
export function formatSurroundingContext(context: SurroundingContext): string {
    const parts: string[] = [];
    if (context.before.length > 0) parts.push(`before "${context.before.join(' / ')}"`);
    if (context.after.length > 0) parts.push(`after "${context.after.join(' / ')}"`);
    return parts.join(', ');
}

import type { ScreenReaderType } from '../../../screen-reader/screen-reader-type';

/** Builds a `ScreenReaderContext` from a collected `LinkInfo`. */
export function createScreenReaderContextFromLink(link: LinkInfo, screenReader: ScreenReaderType): ScreenReaderContext {
    return createScreenReaderContext(
        {
            identifier: link.identifier,
            spokenPhrases: link.spokenPhrases,
            focusedElementText: link.focusedElementText,
            axNode: link.axNode,
        },
        'link',
        link.stepIndex,
        screenReader
    );
}

function extractHref(htmlSnippet: string | null): string | null {
    if (!htmlSnippet) return null;
    const match = htmlSnippet.match(/href\s*=\s*["']([^"']*)["']/i);
    return match?.[1] ?? null;
}

function collectContextText(readingSteps: NavigationStep[], start: number, end: number): string[] {
    const texts: string[] = [];

    for (let i = start; i < end; i++) {
        const step = readingSteps[i]!;
        const role = getRole(step.axNode);

        if (role && INTERACTIVE_ROLES.includes(role)) continue;

        const text = step.focusedElementText.trim();
        if (text.length > MIN_CONTEXT_TEXT_LENGTH) {
            texts.push(text);
        }
    }

    return texts;
}
