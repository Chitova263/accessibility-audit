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

        this.endDetector?.reset();

        while (true) {
            const { spokenPhrases, itemText } = await this.sr.press(this.arrowKey);

            if (spokenPhrases.length === 0) {
                silentPressCount++;
                if (silentPressCount >= 2) {
                    return;
                }
                continue;
            }

            silentPressCount = 0;

            const phrase = spokenPhrases[spokenPhrases.length - 1] ?? '';

            if (this.endDetector?.check({ phrase, itemText })) {
                return;
            }

            if (phrase === previousPhrase && phrase !== '') {
                repeatCount++;

                const effectiveThreshold = this.isDecorativeNoise(phrase) ? 3 : this.repeatThreshold;

                if (repeatCount >= effectiveThreshold) {
                    return;
                }
            } else {
                repeatCount = 0;
            }
            previousPhrase = phrase;

            if (!itemText && !phrase) {
                continue;
            }

            yield { phrase, itemText };
        }
    }

    /**
     * Check if content is decorative noise (icons, placeholders, etc.).
     * Uses a lower repeat threshold to stop quickly on such content.
     */
    private isDecorativeNoise(phrase: string): boolean {
        const stripped = phrase.replace(/[\s\u{FFFC}\u{FFFD}]/gu, '').trim();
        return stripped.length <= 2;
    }
}
