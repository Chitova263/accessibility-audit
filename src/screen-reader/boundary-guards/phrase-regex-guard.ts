import type { NavigationEndContext, NavigationEndDetector } from '../types';

/**
 * Returns false (no more elements) when phrase matches a regex pattern.
 */
export class PhraseRegexGuard implements NavigationEndDetector {
    private readonly regex: RegExp;

    constructor(pattern: string, flags?: string) {
        this.regex = new RegExp(pattern, flags ?? 'i');
    }

    hasNext(ctx: NavigationEndContext): boolean {
        return !this.regex.test(ctx.phrase);
    }

    reset(): void {
        this.regex.lastIndex = 0;
    }
}
