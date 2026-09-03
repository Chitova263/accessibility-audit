import type { NavigationEndContext, NavigationEndDetector } from '../types';

/**
 * Returns false (no more elements) after the same phrase is repeated N times consecutively.
 */
export class RepeatGuard implements NavigationEndDetector {
    private previousPhrase = '';
    private consecutiveRepeatCount = 0;

    constructor(private readonly threshold: number) {}

    hasNext(ctx: NavigationEndContext): boolean {
        const phrase = ctx.phrase;
        if (phrase === this.previousPhrase && phrase !== '') {
            this.consecutiveRepeatCount++;
            return this.consecutiveRepeatCount < this.threshold;
        }
        this.previousPhrase = phrase;
        this.consecutiveRepeatCount = 0;
        return true;
    }

    reset(): void {
        this.previousPhrase = '';
        this.consecutiveRepeatCount = 0;
    }
}
