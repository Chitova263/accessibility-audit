import type { AuditContext } from './context';
import type { Violation, ScreenReaderContext, WcagCriterion, Impact } from './violation';

export interface RuleMeta {
    wcag: {
        primary: WcagCriterion;
        related?: WcagCriterion[];
    };
    impact: Impact;
    summary: string;
}

export interface RuleResult<TContext = ScreenReaderContext, TStats = undefined> {
    violations: Violation<TContext>[];
    stats?: TStats;
}

export interface Rule<TContext = ScreenReaderContext, TStats = undefined> {
    id: string;
    meta: RuleMeta;
    run(ctx: AuditContext): RuleResult<TContext, TStats> | Promise<RuleResult<TContext, TStats>>;
}
