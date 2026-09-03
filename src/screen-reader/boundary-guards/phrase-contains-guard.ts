import type { NavigationEndContext, NavigationEndDetector } from '../types';

/**
 * Returns false (no more elements) when phrase contains a specific text.
 */
export class PhraseContainsGuard implements NavigationEndDetector {
    private readonly searchText: string;

    constructor(
        text: string,
        private readonly caseSensitive: boolean = false
    ) {
        this.searchText = caseSensitive ? text : text.toLowerCase();
    }

    hasNext(ctx: NavigationEndContext): boolean {
        const phrase = this.caseSensitive ? ctx.phrase : ctx.phrase.toLowerCase();
        return !phrase.includes(this.searchText);
    }

    reset(): void {}
}
