/**
 * Analyzer: axe-core
 *
 * Runs axe-core static analysis on the page to detect
 * accessibility violations that can be found without
 * user interaction.
 *
 * Complements NVDA-based analyzers by catching issues
 * that static analysis excels at (color contrast, ARIA
 * attribute validity, etc.)
 */

import AxeBuilder from '@axe-core/playwright';
import type { Violation } from '../violation';
import type { AuditContext } from '../context';

/** Axe-core specific violation details */
export interface AxeToolDetails {
    nodes: Array<{
        html: string;
        target: string[];
        failureSummary: string | undefined;
    }>;
    tags: string[];
    help: string;
    helpUrl: string;
}

export type AxeViolation = Violation<AxeToolDetails>;

export interface AxeCoreAnalyzerResult {
    violations: AxeViolation[];
    summary: {
        totalViolations: number;
        byImpact: Record<string, number>;
        byRule: Record<string, number>;
    };
}

/**
 * Run axe-core analysis on a page
 */
export async function analyzeWithAxeCore({ page }: AuditContext): Promise<AxeCoreAnalyzerResult> {
    const axeResults = await new AxeBuilder({ page }).analyze();
    const violations = convertAxeViolations(axeResults);

    const byImpact: Record<string, number> = {};
    const byRule: Record<string, number> = {};

    for (const v of violations) {
        byImpact[v.impact] = (byImpact[v.impact] ?? 0) + 1;
        byRule[v.ruleId] = (byRule[v.ruleId] ?? 0) + 1;
    }

    return {
        violations,
        summary: {
            totalViolations: violations.length,
            byImpact,
            byRule,
        },
    };
}

/**
 * Extract WCAG criterion from axe-core tags
 */
function extractWcagFromTags(tags: string[]): { criterion: string; level: 'A' | 'AA' | 'AAA' } {
    // Look for specific criterion tags like "wcag111" (1.1.1)
    for (const tag of tags) {
        const criterionMatch = tag.match(/^wcag(\d)(\d)(\d+)$/);
        if (criterionMatch) {
            const criterion = `${criterionMatch[1]}.${criterionMatch[2]}.${criterionMatch[3]}`;
            // Determine level from other tags
            const levelTag = tags.find((t) => /^wcag\d+a{1,3}$/i.test(t));
            const level = levelTag
                ? ((levelTag.match(/a{1,3}$/i)?.[0]?.toUpperCase() as 'A' | 'AA' | 'AAA') ?? 'A')
                : 'A';
            return { criterion, level };
        }
    }

    // Look for tags like "wcag2a", "wcag2aa", "wcag21a", etc.
    for (const tag of tags) {
        const match = tag.match(/^wcag(\d+)(a{1,3})$/i);
        if (match) {
            const level = match[2]!.toUpperCase() as 'A' | 'AA' | 'AAA';
            return { criterion: `WCAG ${match[1]}`, level };
        }
    }

    // Fallback for best-practice rules
    return { criterion: 'best-practice', level: 'A' };
}

/**
 * Convert axe-core results to our unified Violation format
 */
function convertAxeViolations(axeResults: Awaited<ReturnType<AxeBuilder['analyze']>>): AxeViolation[] {
    const violations: AxeViolation[] = [];
    const timestamp = Date.now();

    for (const violation of axeResults.violations) {
        const wcagInfo = extractWcagFromTags(violation.tags);

        for (let i = 0; i < violation.nodes.length; i++) {
            const node = violation.nodes[i]!;

            violations.push({
                id: `axe-${violation.id}-${i}`,
                ruleId: violation.id,
                wcag: {
                    primary: wcagInfo,
                },
                impact: violation.impact ?? 'unknown',
                message: violation.description,
                element: {
                    htmlSnippet: node.html,
                    selector: node.target.join(' '),
                },
                tool: 'axe-core',
                toolVersion: axeResults.testEngine.version,
                timestamp,
                toolDetails: {
                    nodes: violation.nodes.map((n) => ({
                        html: n.html,
                        target: n.target as string[],
                        failureSummary: n.failureSummary,
                    })),
                    tags: violation.tags,
                    help: violation.help,
                    helpUrl: violation.helpUrl,
                },
            });
        }
    }

    return violations;
}
