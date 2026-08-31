import type { AuditContext } from './context';
import type { Violation, NvdaContext, WcagCriterion, Impact } from './violation';

export interface RuleMeta {
    wcag: {
        primary: WcagCriterion;
        related?: WcagCriterion[];
    };
    impact: Impact;
    summary: string;
}

export interface RuleResult<TContext = NvdaContext, TStats = undefined> {
    violations: Violation<TContext>[];
    stats?: TStats;
}

export interface Rule<TContext = NvdaContext, TStats = undefined> {
    id: string;
    meta: RuleMeta;
    run(ctx: AuditContext): Promise<RuleResult<TContext, TStats>>;
}
