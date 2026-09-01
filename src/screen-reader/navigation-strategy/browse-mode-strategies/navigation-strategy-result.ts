import type { NavigationStep, StrategyMetadata, StrategyResult } from './navigation-strategy';

export class NavigationStrategyResult {
    static exhausted(detail: string, meta: StrategyMetadata, steps: NavigationStep[]): StrategyResult {
        return { completionReason: { kind: 'exhausted', detail }, meta, navigationSteps: steps };
    }

    static limitReached(detail: string, meta: StrategyMetadata, steps: NavigationStep[]): StrategyResult {
        return { completionReason: { kind: 'limit-reached', detail }, meta, navigationSteps: steps };
    }

    static cycleComplete(detail: string, meta: StrategyMetadata, steps: NavigationStep[]): StrategyResult {
        return { completionReason: { kind: 'cycle-complete', detail }, meta, navigationSteps: steps };
    }

    static trapped(detail: string, meta: StrategyMetadata, steps: NavigationStep[]): StrategyResult {
        return { completionReason: { kind: 'trapped', detail }, meta, navigationSteps: steps };
    }
}
