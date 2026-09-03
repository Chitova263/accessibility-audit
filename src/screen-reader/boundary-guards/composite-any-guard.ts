import type { NavigationEndContext, NavigationEndDetector } from '../types';

/**
 * Composite guard that returns false when ANY child guard returns false.
 */
export class CompositeAnyGuard implements NavigationEndDetector {
    constructor(private readonly guards: NavigationEndDetector[]) {}

    hasNext(ctx: NavigationEndContext): boolean {
        return this.guards.every((guard) => guard.hasNext(ctx));
    }

    reset(): void {
        this.guards.forEach((guard) => guard.reset());
    }
}
