import type { NavigationEndContext, NavigationEndDetector } from '../types';

const DEFAULT_DOCUMENT_BOUNDARY_PATTERNS = [
    'tool bar',
    'toolbar',
    'address bar',
    'address and search bar',
    'chrome',
    'firefox',
    'edge',
    'safari',
    'brave',
];

/**
 * Returns false (no more elements) when focus leaves the document (e.g., browser toolbar).
 *
 * Detection strategy (in order of reliability):
 * 1. document.hasFocus() === false (most reliable, language-agnostic)
 * 2. NVDA phrase matches browser chrome patterns (fallback)
 */
export class DocumentBoundaryGuard implements NavigationEndDetector {
    private readonly patterns: string[];

    constructor(additionalPatterns?: string[]) {
        this.patterns = additionalPatterns
            ? [...DEFAULT_DOCUMENT_BOUNDARY_PATTERNS, ...additionalPatterns]
            : DEFAULT_DOCUMENT_BOUNDARY_PATTERNS;
    }

    hasNext(ctx: NavigationEndContext): boolean {
        // document.hasFocus() is most reliable: false when focus is on browser chrome
        if (ctx.documentHasFocus === false) {
            return false;
        }

        // Fallback: match NVDA phrase against browser chrome patterns
        const phraseLower = ctx.phrase.toLowerCase();
        const isAtBoundary = this.patterns.some((pattern) => phraseLower.includes(pattern));
        return !isAtBoundary;
    }

    reset(): void {}
}
