/**
 * Rule: axe-core
 *
 * Wrapper rule that runs axe-core static analysis on the page.
 * Axe-core detects accessibility violations that can be found
 * without user interaction, complementing NVDA-based rules.
 *
 * This rule delegates to axe-core and converts its results to
 * our unified Violation format. It does not map to a single
 * WCAG criterion since axe-core covers ~90 different rules.
 *
 * NOTE: This rule is currently disabled. It requires a live Page object
 * which was removed from AuditContext in the screenshot separation refactor.
 * To re-enable, axe-core should be run as a separate phase (like attachScreenshots)
 * or receive its Page dependency through a different mechanism.
 */

import AxeBuilder from '@axe-core/playwright';
import type { Page } from 'playwright';
import type { Rule, RuleMeta, RuleResult } from '../../core/rule';
import type { AxeViolation, AxeContext } from '../../core/violation';
import type { AuditContext } from '../../core/context';

export interface AxeCoreStats {
    totalViolations: number;
    byImpact: Record<string, number>;
    byRule: Record<string, number>;
}

/**
 * Extended context for axe-core rule that includes the Page object.
 * This is separate from AuditContext because axe-core needs live page access.
 */
export interface AxeCoreContext extends AuditContext {
    page?: Page;
}

export class AxeCoreRule implements Rule<AxeContext, AxeCoreStats> {
    readonly id = 'axe-core';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '4.1.2', level: 'A' },
        },
        impact: 'moderate',
        summary: 'axe-core static accessibility analysis',
    };

    async run(ctx: AuditContext): Promise<RuleResult<AxeContext, AxeCoreStats>> {
        // axe-core needs a live Page object which isn't in the standard AuditContext
        const page = (ctx as AxeCoreContext).page;

        if (!page) {
            return {
                violations: [],
                stats: {
                    totalViolations: 0,
                    byImpact: {},
                    byRule: {},
                },
            };
        }

        const axeResults = await new AxeBuilder({ page }).analyze();
        const violations = this.convertAxeViolations(axeResults);

        const byImpact: Record<string, number> = {};
        const byRule: Record<string, number> = {};

        for (const v of violations) {
            byImpact[v.rule.impact] = (byImpact[v.rule.impact] ?? 0) + 1;
            byRule[v.rule.id] = (byRule[v.rule.id] ?? 0) + 1;
        }

        return {
            violations,
            stats: {
                totalViolations: violations.length,
                byImpact,
                byRule,
            },
        };
    }

    private extractWcagFromTags(tags: string[]): { criterion: string; level: 'A' | 'AA' | 'AAA' } {
        for (const tag of tags) {
            const criterionMatch = tag.match(/^wcag(\d)(\d)(\d+)$/);
            if (criterionMatch) {
                const criterion = `${criterionMatch[1]}.${criterionMatch[2]}.${criterionMatch[3]}`;
                const levelTag = tags.find((t) => /^wcag\d+a{1,3}$/i.test(t));
                const level = levelTag
                    ? ((levelTag.match(/a{1,3}$/i)?.[0]?.toUpperCase() as 'A' | 'AA' | 'AAA') ?? 'A')
                    : 'A';
                return { criterion, level };
            }
        }

        for (const tag of tags) {
            const match = tag.match(/^wcag(\d+)(a{1,3})$/i);
            if (match) {
                const level = match[2]!.toUpperCase() as 'A' | 'AA' | 'AAA';
                return { criterion: `WCAG ${match[1]}`, level };
            }
        }

        return { criterion: 'best-practice', level: 'A' };
    }

    /**
     * Convert axe-core results to our unified Violation format
     */
    private convertAxeViolations(axeResults: Awaited<ReturnType<AxeBuilder['analyze']>>): AxeViolation[] {
        const violations: AxeViolation[] = [];
        const timestamp = Date.now();

        for (const violation of axeResults.violations) {
            const wcagInfo = this.extractWcagFromTags(violation.tags);

            for (let i = 0; i < violation.nodes.length; i++) {
                const node = violation.nodes[i]!;

                violations.push({
                    id: `axe-${violation.id}-${i}`,
                    rule: {
                        id: violation.id,
                        summary: violation.help,
                        wcag: {
                            primary: wcagInfo,
                        },
                        impact: (violation.impact as 'critical' | 'serious' | 'moderate' | 'minor') ?? 'moderate',
                    },
                    message: violation.description,
                    element: {
                        htmlSnippet: node.html,
                        selector: node.target.join(' '),
                    },
                    tool: 'axe-core',
                    timestamp,
                    context: {
                        nodes: violation.nodes.map((n) => ({
                            html: n.html,
                            target: n.target as string[],
                            failureSummary: n.failureSummary,
                        })),
                        tags: violation.tags,
                    },
                });
            }
        }

        return violations;
    }
}

export const rule = new AxeCoreRule();
