/**
 * Analyzer: Navigation Size
 *
 * Detects excessively large navigation regions that may overwhelm
 * keyboard and screen reader users.
 *
 * Too many links in navigation forces users to tab through
 * dozens of items before reaching main content.
 *
 * Maps to WCAG 2.4.1 (Bypass Blocks) - related concern.
 */

import type { StrategyResult } from '../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import type { NvdaViolation } from '../../core/violation';
import type { AuditContext } from '../../core/context';
import { createNvdaContext } from '../../utils/tool-details';
import { getRule } from '../../registry/rule-catalog';

/** Threshold for "excessive" navigation links */
const EXCESSIVE_NAV_LINKS_THRESHOLD = 40;

/** Threshold for "very excessive" - definitely problematic */
const VERY_EXCESSIVE_NAV_LINKS_THRESHOLD = 75;

export interface NavigationSizeAnalyzerResult {
    violations: NvdaViolation[];
    summary: {
        totalLinks: number;
        navigationLandmarks: number;
        linksPerNavigation: Record<string, number>;
    };
}

interface NavLinkInfo {
    landmarkName: string;
    linkCount: number;
    firstLinkStep: {
        identifier: string;
        spokenPhrases: string[];
        itemText: string;
        timestamp: number;
        htmlSnippet: string | null;
        axNode: unknown;
    } | null;
}

export function analyzeNavigationSize({ transcript }: AuditContext): NavigationSizeAnalyzerResult {
    const violations: NvdaViolation[] = [];

    // Count total links from link strategy
    let totalLinks = 0;
    for (const result of transcript) {
        if ((result.meta.type ?? result.meta.name) === 'link') {
            totalLinks = result.navigationSteps.length;
            break;
        }
    }

    // Count navigation landmarks
    const navigationLandmarks: NavLinkInfo[] = [];

    for (const result of transcript) {
        if ((result.meta.type ?? result.meta.name) !== 'landmark') continue;

        for (const step of result.navigationSteps) {
            const node = step.axNode;
            const role = node?.role?.value;

            if (role === 'navigation') {
                navigationLandmarks.push({
                    landmarkName: node?.name?.value || '(unnamed navigation)',
                    linkCount: 0, // We'll estimate this
                    firstLinkStep: null,
                });
            }
        }
    }

    // Heuristic: If we have total links and navigation landmarks,
    // estimate links per navigation (simplified - assumes even distribution)
    // In reality, we'd need to analyze DOM structure to know exactly
    const linksPerNavigation: Record<string, number> = {};

    if (navigationLandmarks.length > 0) {
        // Simple heuristic: divide total links by nav count
        // This is imprecise but gives a rough idea
        const avgLinks = Math.round(totalLinks / navigationLandmarks.length);

        for (const nav of navigationLandmarks) {
            linksPerNavigation[nav.landmarkName] = avgLinks;
        }
    }

    // Check if total links is excessive (page-level check)
    if (totalLinks >= VERY_EXCESSIVE_NAV_LINKS_THRESHOLD) {
        // Find first link for violation context
        let firstLinkStep = null;
        for (const result of transcript) {
            if ((result.meta.type ?? result.meta.name) === 'link' && result.navigationSteps.length > 0) {
                firstLinkStep = result.navigationSteps[0]!;
                break;
            }
        }

        if (firstLinkStep) {
            violations.push(createExcessiveLinksViolation(totalLinks, firstLinkStep, 'critical'));
        }
    } else if (totalLinks >= EXCESSIVE_NAV_LINKS_THRESHOLD) {
        let firstLinkStep = null;
        for (const result of transcript) {
            if ((result.meta.type ?? result.meta.name) === 'link' && result.navigationSteps.length > 0) {
                firstLinkStep = result.navigationSteps[0]!;
                break;
            }
        }

        if (firstLinkStep) {
            violations.push(createExcessiveLinksViolation(totalLinks, firstLinkStep, 'moderate'));
        }
    }

    return {
        violations,
        summary: {
            totalLinks,
            navigationLandmarks: navigationLandmarks.length,
            linksPerNavigation,
        },
    };
}

function createExcessiveLinksViolation(
    linkCount: number,
    firstLinkStep: {
        identifier: string;
        spokenPhrases: string[];
        itemText: string;
        timestamp: number;
        htmlSnippet: string | null;
        axNode: unknown;
    },
    severity: 'critical' | 'moderate'
): NvdaViolation {
    const threshold = severity === 'critical' ? VERY_EXCESSIVE_NAV_LINKS_THRESHOLD : EXCESSIVE_NAV_LINKS_THRESHOLD;

    return {
        id: `excessive-navigation-${firstLinkStep.identifier}`,
        rule: getRule('excessive-navigation-links', severity === 'critical' ? 'serious' : 'moderate'),
        message: `Page has ${linkCount} links (threshold: ${threshold}). Excessive links make keyboard navigation tedious. Consider grouping links, using skip links, or simplifying navigation structure.`,
        element: {},
        tool: 'nvda-audit',
        timestamp: firstLinkStep.timestamp,
        context: createNvdaContext(
            {
                identifier: firstLinkStep.identifier,
                spokenPhrases: firstLinkStep.spokenPhrases,
                itemText: firstLinkStep.itemText,
                axNode: firstLinkStep.axNode,
            },
            'link',
            0
        ),
    };
}
