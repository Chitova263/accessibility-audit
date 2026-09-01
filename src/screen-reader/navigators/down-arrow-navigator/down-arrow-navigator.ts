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

        // Reset end detector state at start of iteration
        this.endDetector?.reset();

        while (true) {
            await this.sr.press(this.arrowKey);

            const phrase = await this.sr.lastSpokenPhrase();
            const itemText = await this.sr.itemText();

            // Check end detector first (for loop detection with virtual reader)
            if (this.endDetector?.check({ phrase, itemText })) {
                return;
            }

            // Fallback: consecutive repeat detection (for NVDA)
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
