/**
 * Rule: Excessive Navigation Links
 *
 * Detects pages with too many links, which overwhelm keyboard and screen
 * reader users by forcing them to tab through dozens of items before
 * reaching main content.
 *
 * Maps to WCAG 2.4.1 (Bypass Blocks) - related concern.
 */

import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { buildViolation } from '../../rule-catalog';
import { createScreenReaderContext } from '../../../utils/tool-details';
import { getRole, getName } from '../../../../types/ax-utils';

/** Threshold for "excessive" navigation links */
const EXCESSIVE_NAV_LINKS_THRESHOLD = 40;

/** Threshold for "very excessive" - definitely problematic */
const VERY_EXCESSIVE_NAV_LINKS_THRESHOLD = 75;

export interface ExcessiveNavigationLinksStats {
    totalLinks: number;
    navigationLandmarks: number;
    linksPerNavigation: Record<string, number>;
}

export class ExcessiveNavigationLinksRule implements Rule<ScreenReaderContext, ExcessiveNavigationLinksStats> {
    readonly id = 'excessive-navigation-links';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '2.4.1', level: 'A' },
        },
        summary: 'Page has an excessive number of links',
    };

    run(ctx: AuditContext): RuleResult<ScreenReaderContext, ExcessiveNavigationLinksStats> {
        const { transcript, screenReader } = ctx;
        const violations: ScreenReaderViolation[] = [];

        let totalLinks = 0;
        for (const result of transcript) {
            if (result.meta.name === 'link') {
                totalLinks = result.navigationSteps.length;
                break;
            }
        }

        const navigationLandmarkNames: string[] = [];
        for (const result of transcript) {
            if (result.meta.name !== 'landmark') continue;

            for (const step of result.navigationSteps) {
                const role = getRole(step.axNode);
                if (role === 'navigation') {
                    navigationLandmarkNames.push(getName(step.axNode) || '(unnamed navigation)');
                }
            }
        }

        const linksPerNavigation: Record<string, number> = {};
        if (navigationLandmarkNames.length > 0) {
            const avgLinks = Math.round(totalLinks / navigationLandmarkNames.length);
            for (const name of navigationLandmarkNames) {
                linksPerNavigation[name] = avgLinks;
            }
        }

        const firstLinkStep = this.findFirstLinkStep(transcript);

        if (firstLinkStep !== null) {
            if (totalLinks >= VERY_EXCESSIVE_NAV_LINKS_THRESHOLD) {
                const context = createScreenReaderContext(
                    {
                        identifier: firstLinkStep.identifier,
                        spokenPhrases: firstLinkStep.spokenPhrases,
                        focusedElementText: firstLinkStep.focusedElementText,
                        axNode: firstLinkStep.axNode,
                    },
                    'link',
                    0,
                    screenReader
                );
                violations.push(
                    buildViolation({
                        ruleId: 'excessive-navigation-links',
                        impact: 'serious',
                        stepId: firstLinkStep.identifier,
                        message: `Page has ${totalLinks} links (threshold: ${VERY_EXCESSIVE_NAV_LINKS_THRESHOLD}). Excessive links make keyboard navigation tedious. Consider grouping links, using skip links, or simplifying navigation structure.`,
                        timestamp: firstLinkStep.timestamp,
                        context,
                        screenReader,
                    })
                );
            } else if (totalLinks >= EXCESSIVE_NAV_LINKS_THRESHOLD) {
                const context = createScreenReaderContext(
                    {
                        identifier: firstLinkStep.identifier,
                        spokenPhrases: firstLinkStep.spokenPhrases,
                        focusedElementText: firstLinkStep.focusedElementText,
                        axNode: firstLinkStep.axNode,
                    },
                    'link',
                    0,
                    screenReader
                );
                violations.push(
                    buildViolation({
                        ruleId: 'excessive-navigation-links',
                        impact: 'moderate',
                        stepId: firstLinkStep.identifier,
                        message: `Page has ${totalLinks} links (threshold: ${EXCESSIVE_NAV_LINKS_THRESHOLD}). Excessive links make keyboard navigation tedious. Consider grouping links, using skip links, or simplifying navigation structure.`,
                        timestamp: firstLinkStep.timestamp,
                        context,
                        screenReader,
                    })
                );
            }
        }

        return {
            violations,
            stats: {
                totalLinks,
                navigationLandmarks: navigationLandmarkNames.length,
                linksPerNavigation,
            },
        };
    }

    private findFirstLinkStep(transcript: AuditContext['transcript']) {
        for (const result of transcript) {
            if (result.meta.name === 'link' && result.navigationSteps.length > 0) {
                return result.navigationSteps[0]!;
            }
        }
        return null;
    }
}

export const rule = new ExcessiveNavigationLinksRule();
