/**
 * Violation Utilities
 *
 * Helper functions for summarizing and analyzing violations.
 */

import type { Violation } from '../core/violation';

export interface ViolationTotals {
    total: number;
    byTool: Record<string, number>;
    byImpact: Record<string, number>;
    byRule: Record<string, number>;
}

export function summarizeViolations(violations: readonly Violation[]): ViolationTotals {
    const totals: ViolationTotals = { total: violations.length, byTool: {}, byImpact: {}, byRule: {} };

    for (const violation of violations) {
        totals.byTool[violation.tool] = (totals.byTool[violation.tool] ?? 0) + 1;
        totals.byImpact[violation.rule.impact] = (totals.byImpact[violation.rule.impact] ?? 0) + 1;
        totals.byRule[violation.rule.id] = (totals.byRule[violation.rule.id] ?? 0) + 1;
    }

    return totals;
}
