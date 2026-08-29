/**
 * Analyzer: Skip Link
 *
 * Detects whether the page has a skip link (skip to main content)
 * that appears early in the tab order.
 *
 * Skip links help keyboard users bypass repetitive navigation
 * and jump directly to main content.
 *
 * Maps to WCAG 2.4.1 (Bypass Blocks).
 */

import type { StrategyResult } from '../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import type { NvdaViolation, NvdaToolDetails } from '../violation';

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

export interface SkipLinkAnalyzerResult {
    violations: NvdaViolation[];
    summary: {
        skipLinkFound: boolean;
        skipLinkPosition: number | null;
        firstFewTabStops: string[];
    };
}

export function analyzeSkipLink(strategyResults: StrategyResult[]): SkipLinkAnalyzerResult {
    const violations: NvdaViolation[] = [];
    let skipLinkFound = false;
    let skipLinkPosition: number | null = null;
    const firstFewTabStops: string[] = [];

    // Find tab strategy results
    for (const result of strategyResults) {
        const strategyType = result.meta.type ?? result.meta.name;

        if (strategyType !== 'tab') continue;

        // Check first N tab stops for skip link
        const stepsToCheck = Math.min(result.navigationSteps.length, MAX_TAB_STOPS_TO_CHECK);

        for (let i = 0; i < stepsToCheck; i++) {
            const step = result.navigationSteps[i]!;
            const node = step.axNode;
            const name = node?.name?.value ?? step.itemText ?? '';
            const htmlSnippet = step.htmlSnippet ?? '';

            firstFewTabStops.push(name || `(${node?.role?.value ?? 'unknown'})`);

            if (isSkipLink(name, htmlSnippet)) {
                skipLinkFound = true;
                skipLinkPosition = i + 1; // 1-based position
                break;
            }
        }

        // Only process first tab strategy found
        if (result.navigationSteps.length > 0 && !skipLinkFound) {
            // No skip link found - create violation
            const firstStep = result.navigationSteps[0]!;
            violations.push(createMissingSkipLinkViolation(firstStep, firstFewTabStops));
        }

        break; // Only check first tab strategy
    }

    return {
        violations,
        summary: {
            skipLinkFound,
            skipLinkPosition,
            firstFewTabStops,
        },
    };
}

function isSkipLink(name: string, htmlSnippet: string): boolean {
    // Check name patterns
    const nameMatches = SKIP_LINK_NAME_PATTERNS.some((pattern) => pattern.test(name));
    if (nameMatches) return true;

    // Check href patterns in HTML
    const hrefMatches = SKIP_LINK_HREF_PATTERNS.some((pattern) => pattern.test(htmlSnippet));
    if (hrefMatches) return true;

    return false;
}

function createMissingSkipLinkViolation(
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
    const toolDetails: NvdaToolDetails = {
        spokenPhrases: firstStep.spokenPhrases,
        itemText: firstStep.itemText,
        navigationStrategy: 'tab',
        stepIndex: 0,
        axNode: firstStep.axNode as NvdaToolDetails['axNode'],
    };

    return {
        id: `missing-skip-link-${firstStep.identifier}`,
        ruleId: 'missing-skip-link',
        wcag: {
            primary: { criterion: '2.4.1', level: 'A' },
        },
        impact: 'serious',
        message: `No skip link found in the first ${MAX_TAB_STOPS_TO_CHECK} tab stops. Skip links help keyboard users bypass navigation and jump to main content. First tab stops: ${firstFewTabStops.join(', ')}.`,
        element: {
            htmlSnippet: undefined,
        },
        tool: 'nvda-audit',
        timestamp: firstStep.timestamp,
        toolDetails,
    };
}
