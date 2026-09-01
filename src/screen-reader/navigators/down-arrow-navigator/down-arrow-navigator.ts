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
            await this.sr.press(this.arrowKey);

            // Check if NVDA actually spoke something new
            // press() clears the log first, so empty log = no new speech = end of document
            const log = await this.sr.spokenPhraseLog();
            
            if (log.length === 0) {
                // NVDA didn't speak anything - we're at the end of the document
                // NVDA plays an error beep but doesn't re-announce
                silentPressCount++;
                if (silentPressCount >= 2) {
                    // Confirm end of document after 2 silent presses
                    return;
                }
                continue;
            }
            
            silentPressCount = 0;
            const phrase = await this.sr.lastSpokenPhrase();
            const itemText = await this.sr.itemText();

            // Check end detector first (for loop detection with virtual reader)
            if (this.endDetector?.check({ phrase, itemText })) {
                return;
            }

            // Fallback: consecutive repeat detection (same element announced multiple times)
            if (phrase === previousPhrase && phrase !== '') {
                repeatCount++;
                if (repeatCount >= this.repeatThreshold) {
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
}
