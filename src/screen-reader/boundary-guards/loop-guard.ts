import type { NavigationEndContext, NavigationEndDetector } from '../types';

/**
 * Returns false (no more elements) when the same value is seen twice (loop/wrap-around).
 */
export class LoopGuard implements NavigationEndDetector {
    private readonly seen = new Set<string>();

    constructor(private readonly key: 'phrase' | 'focusedElementText') {}

    hasNext(ctx: NavigationEndContext): boolean {
        const value = ctx[this.key];
        if (this.seen.has(value)) {
            return false;
        }
        this.seen.add(value);
        return true;
    }

    reset(): void {
        this.seen.clear();
    }
}
