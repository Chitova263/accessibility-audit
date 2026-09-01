import type { EndDetectionStrategy, EndDetector, EndDetectionContext } from './types';

/**
 * Creates an EndDetector from a declarative EndDetectionStrategy.
 */
export function createEndDetector(strategy: EndDetectionStrategy): EndDetector {
    switch (strategy.type) {
        case 'phrase-contains':
            return createPhraseContainsDetector(strategy.text, strategy.caseSensitive ?? false);

        case 'phrase-regex':
            return createPhraseRegexDetector(strategy.pattern, strategy.flags);

        case 'loop-detection':
            return createLoopDetector(strategy.key ?? 'phrase');

        case 'any':
            return createAnyDetector(strategy.of);

        default: {
            const _exhaustive: never = strategy;
            throw new Error(`Unknown end detection strategy type: ${(_exhaustive as EndDetectionStrategy).type}`);
        }
    }
}

function createPhraseContainsDetector(text: string, caseSensitive: boolean): EndDetector {
    const searchText = caseSensitive ? text : text.toLowerCase();

    return {
        check(ctx: EndDetectionContext): boolean {
            const phrase = caseSensitive ? ctx.phrase : ctx.phrase.toLowerCase();
            return phrase.includes(searchText);
        },
        reset(): void {},
    };
}

function createPhraseRegexDetector(pattern: string, flags?: string): EndDetector {
    const regex = new RegExp(pattern, flags ?? 'i');

    return {
        check(ctx: EndDetectionContext): boolean {
            return regex.test(ctx.phrase);
        },
        reset(): void {
            regex.lastIndex = 0;
        },
    };
}

function createLoopDetector(key: 'phrase' | 'itemText'): EndDetector {
    const seen = new Set<string>();

    return {
        check(ctx: EndDetectionContext): boolean {
            const value = ctx[key];
            if (seen.has(value)) {
                return true;
            }
            seen.add(value);
            return false;
        },
        reset(): void {
            seen.clear();
        },
    };
}

function createAnyDetector(strategies: EndDetectionStrategy[]): EndDetector {
    const detectors = strategies.map(createEndDetector);

    return {
        check(ctx: EndDetectionContext): boolean {
            return detectors.some((detector) => detector.check(ctx));
        },
        reset(): void {
            detectors.forEach((detector) => detector.reset());
        },
    };
}
