import type { EndDetectionContext, EndDetectionStrategy, EndDetector } from './types';

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
 * Creates an EndDetector from a declarative EndDetectionStrategy.
 */
export function createEndDetector(strategy: EndDetectionStrategy): EndDetector {
    switch (strategy.type) {
        case 'phrase-contains':
            return new PhraseContainsDetector(strategy.text, strategy.caseSensitive ?? false);
        case 'phrase-regex':
            return new PhraseRegexDetector(strategy.pattern, strategy.flags);
        case 'loop-detection':
            return new LoopDetector(strategy.key ?? 'phrase');
        case 'document-boundary':
            return new DocumentBoundaryDetector(strategy.additionalPatterns);
        case 'any':
            return new CompositeAnyDetector(strategy.of);
        default: {
            throw new Error(`Unknown end detection strategy`);
        }
    }
}

/**
 * Detects end when phrase contains a specific text.
 */
class PhraseContainsDetector implements EndDetector {
    private readonly searchText: string;

    constructor(
        text: string,
        private readonly caseSensitive: boolean
    ) {
        this.searchText = caseSensitive ? text : text.toLowerCase();
    }

    check(ctx: EndDetectionContext): boolean {
        const phrase = this.caseSensitive ? ctx.phrase : ctx.phrase.toLowerCase();
        return phrase.includes(this.searchText);
    }

    reset(): void {}
}

/**
 * Detects end when phrase matches a regex pattern.
 */
class PhraseRegexDetector implements EndDetector {
    private readonly regex: RegExp;

    constructor(pattern: string, flags?: string) {
        this.regex = new RegExp(pattern, flags ?? 'i');
    }

    check(ctx: EndDetectionContext): boolean {
        return this.regex.test(ctx.phrase);
    }

    reset(): void {
        this.regex.lastIndex = 0;
    }
}

/**
 * Detects end when the same value is seen twice (loop/wrap-around).
 */
class LoopDetector implements EndDetector {
    private readonly seen = new Set<string>();

    constructor(private readonly key: 'phrase' | 'focusedElementText') {}

    check(ctx: EndDetectionContext): boolean {
        const value = ctx[this.key];
        if (this.seen.has(value)) {
            return true;
        }
        this.seen.add(value);
        return false;
    }

    reset(): void {
        this.seen.clear();
    }
}

/**
 * Detects end when focus leaves the document (e.g., browser toolbar).
 *
 * Detection strategy (in order of reliability):
 * 1. document.hasFocus() === false (most reliable, language-agnostic)
 * 2. NVDA phrase matches browser chrome patterns (fallback)
 *
 * Note: We cannot rely on backendNodeId being null because document.activeElement
 * always returns a DOM element (typically <body>) even when system focus is on
 * browser chrome.
 */
class DocumentBoundaryDetector implements EndDetector {
    private readonly patterns: string[];

    constructor(additionalPatterns?: string[]) {
        this.patterns = additionalPatterns
            ? [...DEFAULT_DOCUMENT_BOUNDARY_PATTERNS, ...additionalPatterns]
            : DEFAULT_DOCUMENT_BOUNDARY_PATTERNS;
    }

    check(ctx: EndDetectionContext): boolean {
        // Primary signal: document.hasFocus() is the authoritative API
        // Returns false when focus is on browser chrome (toolbar, address bar, etc.)
        if (ctx.documentHasFocus === false) {
            return true;
        }

        // Fallback: check NVDA announcement patterns
        // Useful when documentHasFocus is not available or as defense in depth
        const phraseLower = ctx.phrase.toLowerCase();
        return this.patterns.some((pattern) => phraseLower.includes(pattern));
    }

    reset(): void {}
}

/**
 * Composite detector that triggers when ANY child detector triggers.
 */
class CompositeAnyDetector implements EndDetector {
    private readonly detectors: EndDetector[];

    constructor(strategies: EndDetectionStrategy[]) {
        this.detectors = strategies.map(createEndDetector);
    }

    check(ctx: EndDetectionContext): boolean {
        return this.detectors.some((detector) => detector.check(ctx));
    }

    reset(): void {
        this.detectors.forEach((detector) => detector.reset());
    }
}
