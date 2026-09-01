import type { ScreenReader } from '../../drivers/nvda';
import type { IElementNavigator, NavigationItem, EndDetector } from '../types';

export class DownArrowNavigator implements IElementNavigator {
    public readonly type = 'linear' as const;

    constructor(
        private readonly sr: ScreenReader,
        private readonly arrowKey: string = 'Down',
        private readonly repeatThreshold: number = 30,
        private readonly endDetector?: EndDetector
    ) {}

    async *[Symbol.asyncIterator](): AsyncIterableIterator<NavigationItem> {
        let previousPhrase = '';
        let repeatCount = 0;
        let silentPressCount = 0;

        // Reset end detector state at start of iteration
        this.endDetector?.reset();

        while (true) {
            const { spokenPhrases, itemText } = await this.sr.press(this.arrowKey);

            // If NVDA didn't speak anything, we're at end of document
            if (spokenPhrases.length === 0) {
                silentPressCount++;
                if (silentPressCount >= 2) {
                    return; // Confirmed end of document
                }
                continue;
            }
            
            silentPressCount = 0;
            
            // Use the last phrase (most complete announcement)
            const phrase = spokenPhrases[spokenPhrases.length - 1] ?? '';

            // Check end detector (for loop detection with virtual reader)
            if (this.endDetector?.check({ phrase, itemText })) {
                return;
            }

            // Check for consecutive repeats BEFORE yielding
            if (phrase === previousPhrase && phrase !== '') {
                repeatCount++;
                
                // Use lower threshold for decorative/noise content (likely stuck at end)
                const effectiveThreshold = this.isDecorativeNoise(phrase) ? 3 : this.repeatThreshold;
                
                if (repeatCount >= effectiveThreshold) {
                    return; // Stop - don't yield more repeats
                }
            } else {
                repeatCount = 0;
            }
            previousPhrase = phrase;

            // Skip completely empty items
            if (!itemText && !phrase) {
                continue;
            }

            yield { phrase, itemText };
        }
    }

    /**
     * Check if content is decorative noise (icons, placeholders, etc.).
     * These typically appear at end of document and provide no useful information.
     * Uses a lower repeat threshold to stop quickly on such content.
     */
    private isDecorativeNoise(phrase: string): boolean {
        // Strip whitespace and object replacement characters (used for images/icons)
        const stripped = phrase.replace(/[\s\u{FFFC}\u{FFFD}]/gu, '').trim();
        // Consider noise if 2 chars or less after stripping
        return stripped.length <= 2;
    }
}
