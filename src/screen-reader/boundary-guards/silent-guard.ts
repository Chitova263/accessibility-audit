import type { NavigationEndContext, NavigationEndDetector } from '../types';

/**
 * Returns false (no more elements) after N consecutive key presses with no speech output.
 */
export class SilentGuard implements NavigationEndDetector {
    private consecutiveSilentCount = 0;

    constructor(private readonly threshold: number) {}

    hasNext(ctx: NavigationEndContext): boolean {
        const isSilent = !ctx.phrase || ctx.phrase.trim() === '';
        if (isSilent) {
            this.consecutiveSilentCount++;
            return this.consecutiveSilentCount < this.threshold;
        }
        this.consecutiveSilentCount = 0;
        return true;
    }

    reset(): void {
        this.consecutiveSilentCount = 0;
    }
}
